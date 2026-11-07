/**
 * One play-through of one case: what the detective knows, what has been examined, credibility,
 * mistakes and the final accusation. Pure: no DOM, no randomness, serialisable with toJSON().
 *
 * Every piece of knowledge is a *clue* id from `case.clues` (physical evidence, testimony or a
 * deduction). Locations, points of interest, suspects and statements may `require` clues, so
 * the story opens up as the notebook fills.
 */

export const MAX_CREDIBILITY = 5;
export const CREDIBILITY_COST = { present: 1, accuse: 2 };
export const SCORE_COST = { present: 12, deduce: 4, accuse: 20, hint: 6 };
export const RANKS = [
  { rank: "S", min: 95 },
  { rank: "A", min: 80 },
  { rank: "B", min: 60 },
  { rank: "C", min: 0 },
];
export const ACCUSATION_PARTS = ["culprit", "method", "motive", "evidence"];

const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const pairKey = (a, b) => [a, b].sort().join("+");

export class Investigation {
  constructor(caseData, saved = null) {
    this.case = caseData;
    this.clueById = new Map(caseData.clues.map((clue) => [clue.id, clue]));
    this.deductionByPair = new Map(caseData.deductions.map((d) => [pairKey(...d.from), d]));

    this.found = []; // clue ids in the order they were found (the notebook)
    this.examined = new Set(); // "location/hotspot"
    this.resolved = new Set(); // "suspect/statement"
    this.deduced = new Set(); // deduction ids
    this.credibility = MAX_CREDIBILITY;
    this.mistakes = { present: 0, deduce: 0, accuse: 0 };
    this.hints = 0;
    this.status = "investigating"; // → "solved" | "failed"
    this.log = [];

    if (saved) this.#restore(saved);
    else this.#gain(caseData.start ?? [], "Hồ sơ ban đầu");
  }

  // Knowledge ----------------------------------------------------------------------------

  has(clueId) {
    return this.found.includes(clueId);
  }

  meets(requires) {
    return list(requires).every((id) => this.has(id));
  }

  clue(id) {
    return this.clueById.get(id);
  }

  notebook() {
    return this.found.map((id) => this.clue(id));
  }

  // What is visible now --------------------------------------------------------------------

  locations() {
    return this.case.locations.filter((location) => this.meets(location.requires));
  }

  location(id) {
    return this.locations().find((location) => location.id === id) ?? null;
  }

  hotspots(locationId) {
    const location = this.location(locationId);
    if (!location) return [];
    return location.hotspots
      .filter((spot) => this.meets(spot.requires))
      .map((spot) => ({ ...spot, examined: this.examined.has(`${locationId}/${spot.id}`) }));
  }

  suspects() {
    return this.case.suspects.filter((suspect) => this.meets(suspect.requires));
  }

  suspect(id) {
    return this.suspects().find((suspect) => suspect.id === id) ?? null;
  }

  statements(suspectId) {
    const suspect = this.suspect(suspectId);
    if (!suspect) return [];
    return suspect.statements
      .filter((statement) => this.meets(statement.requires))
      .map((statement) => ({ ...statement, resolved: this.resolved.has(`${suspectId}/${statement.id}`) }));
  }

  // Actions --------------------------------------------------------------------------------

  /** Look at a point of interest. Free; may add clues. */
  examine(locationId, hotspotId) {
    this.#assertPlaying();
    const spot = this.hotspots(locationId).find((s) => s.id === hotspotId);
    if (!spot) throw new Error(`Không thể xem ${locationId}/${hotspotId}`);
    const key = `${locationId}/${hotspotId}`;
    const again = this.examined.has(key);
    this.examined.add(key);
    const location = this.location(locationId);
    const gained = this.#gain(spot.gives, `${location.name} · ${spot.name}`, spot.text);
    return { text: spot.text, gained, again };
  }

  /** Listen to a suspect: every statement heard adds its testimony clues. Free. */
  interview(suspectId) {
    this.#assertPlaying();
    const suspect = this.suspect(suspectId);
    if (!suspect) throw new Error(`Không gặp được ${suspectId}`);
    const gained = [];
    for (const statement of this.statements(suspectId)) {
      if (list(statement.gives).some((id) => !this.has(id))) {
        gained.push(...this.#gain(statement.gives, `Lời khai · ${suspect.name}`, statement.text));
      }
    }
    return { gained };
  }

  /** Present a clue against a statement. The right clue exposes a contradiction. */
  present(suspectId, statementId, clueId) {
    this.#assertPlaying();
    const statement = this.statements(suspectId).find((s) => s.id === statementId);
    if (!statement) throw new Error(`Không có lời khai ${suspectId}/${statementId}`);
    if (!this.has(clueId)) throw new Error(`Chưa có manh mối ${clueId}`);
    if (statement.resolved) return { correct: true, already: true, text: statement.contradiction.reply, gained: [] };

    const accepted = list(statement.contradiction?.clue);
    if (!accepted.includes(clueId)) {
      this.mistakes.present += 1;
      this.#loseCredibility(CREDIBILITY_COST.present);
      return { correct: false, credibility: this.credibility, failed: this.status === "failed" };
    }
    this.resolved.add(`${suspectId}/${statementId}`);
    const suspect = this.suspect(suspectId);
    const gained = this.#gain(statement.contradiction.gives, `Đối chất · ${suspect.name}`, statement.contradiction.reply);
    return { correct: true, text: statement.contradiction.reply, gained };
  }

  /** Combine two clues. The right pair adds a deduction. A wrong pair is only a mistake. */
  deduce(firstId, secondId) {
    this.#assertPlaying();
    if (!this.has(firstId) || !this.has(secondId)) throw new Error("Chưa có đủ manh mối để ghép");
    const deduction = firstId === secondId ? null : this.deductionByPair.get(pairKey(firstId, secondId));
    if (!deduction) {
      this.mistakes.deduce += 1;
      return { correct: false };
    }
    if (this.deduced.has(deduction.id)) return { correct: true, already: true, text: deduction.text, gained: [] };
    this.deduced.add(deduction.id);
    const gained = this.#gain(deduction.gives, "Suy luận", deduction.text);
    return { correct: true, text: deduction.text, gained };
  }

  /**
   * Final accusation. Says how many of the four parts were right, never which ones.
   * `answer` = { culprit, method, motive, evidence } (ids).
   */
  accuse(answer) {
    this.#assertPlaying();
    const truth = this.case.accusation;
    if (answer.evidence && !this.has(answer.evidence)) throw new Error("Chứng cứ phải nằm trong sổ tay");
    const parts = {
      culprit: answer.culprit === truth.culprit,
      method: answer.method === truth.method.answer,
      motive: answer.motive === truth.motive.answer,
      evidence: list(truth.evidence).includes(answer.evidence),
    };
    const right = ACCUSATION_PARTS.filter((part) => parts[part]).length;
    if (right === ACCUSATION_PARTS.length) {
      this.status = "solved";
      this.log.push({ title: "Buộc tội thành công", text: "Vụ án đã được phá." });
      return { correct: true, right, of: ACCUSATION_PARTS.length };
    }
    this.mistakes.accuse += 1;
    this.#loseCredibility(CREDIBILITY_COST.accuse);
    return { correct: false, right, of: ACCUSATION_PARTS.length, credibility: this.credibility, failed: this.status === "failed" };
  }

  /** Records that a hint was used (the hint itself comes from the solver). */
  useHint() {
    this.hints += 1;
  }

  // Scoring ----------------------------------------------------------------------------------

  get score() {
    const cost =
      this.mistakes.present * SCORE_COST.present +
      this.mistakes.deduce * SCORE_COST.deduce +
      this.mistakes.accuse * SCORE_COST.accuse +
      this.hints * SCORE_COST.hint;
    return Math.max(0, 100 - cost);
  }

  get rank() {
    return RANKS.find((r) => this.score >= r.min).rank;
  }

  /** Fraction of all clues in the case found so far (0..1). */
  get progress() {
    return this.found.length / this.case.clues.length;
  }

  // Persistence ------------------------------------------------------------------------------

  toJSON() {
    return {
      caseId: this.case.id,
      found: [...this.found],
      examined: [...this.examined],
      resolved: [...this.resolved],
      deduced: [...this.deduced],
      credibility: this.credibility,
      mistakes: { ...this.mistakes },
      hints: this.hints,
      status: this.status,
      log: this.log.map((entry) => ({ ...entry })),
    };
  }

  #restore(saved) {
    if (saved.caseId !== this.case.id) throw new Error("Bản lưu thuộc vụ án khác");
    this.found = saved.found.filter((id) => this.clueById.has(id));
    this.examined = new Set(saved.examined);
    this.resolved = new Set(saved.resolved);
    this.deduced = new Set(saved.deduced);
    this.credibility = saved.credibility;
    this.mistakes = { ...this.mistakes, ...saved.mistakes };
    this.hints = saved.hints;
    this.status = saved.status;
    this.log = saved.log ?? [];
  }

  // Internals --------------------------------------------------------------------------------

  #gain(ids, title, text = null) {
    const gained = [];
    for (const id of list(ids)) {
      if (this.has(id)) continue;
      if (!this.clueById.has(id)) throw new Error(`Manh mối không tồn tại: ${id}`);
      this.found.push(id);
      gained.push(this.clue(id));
    }
    if (text || gained.length) this.log.push({ title, text, clues: gained.map((c) => c.id) });
    return gained;
  }

  #loseCredibility(amount) {
    this.credibility = Math.max(0, this.credibility - amount);
    if (this.credibility === 0) this.status = "failed";
  }

  #assertPlaying() {
    if (this.status !== "investigating") throw new Error("Vụ án đã kết thúc");
  }
}
