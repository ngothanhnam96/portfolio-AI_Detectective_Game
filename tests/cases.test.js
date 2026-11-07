import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CASES, caseById, isUnlocked } from "../src/core/cases/index.js";
import { Investigation, MAX_CREDIBILITY } from "../src/core/investigation.js";
import { validateCase } from "../src/core/schema.js";
import { applyStep, explore, nextStep, solve } from "../src/core/solver.js";

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (items, rng) => items[Math.floor(rng() * items.length)];

describe("casebook", () => {
  it("has three cases in difficulty order with unique ids", () => {
    assert.deepEqual(CASES.map((c) => c.difficulty), [1, 2, 3]);
    assert.equal(new Set(CASES.map((c) => c.id)).size, 3);
    assert.equal(caseById("dai-bang").title, "Dải Băng Lốm Đốm");
    assert.equal(caseById("nope"), null);
  });

  it("unlocks each case after the previous one is solved", () => {
    assert.equal(isUnlocked("dong-ho", []), true);
    assert.equal(isUnlocked("dai-bang", []), false);
    assert.equal(isUnlocked("dai-bang", ["dong-ho"]), true);
    assert.equal(isUnlocked("phong-khoa", ["dong-ho"]), false);
    assert.equal(isUnlocked("phong-khoa", ["dong-ho", "dai-bang"]), true);
  });

  it("CR-2: the Speckled Band adaptation credits Conan Doyle and Project Gutenberg", () => {
    const c = caseById("dai-bang");
    assert.equal(c.source.kind, "adaptation");
    assert.equal(c.source.author, "Arthur Conan Doyle");
    assert.match(c.source.url, /gutenberg\.org\/ebooks\/1661/);
    assert.match(c.epilogue.at(-1), /Conan Doyle.*Project Gutenberg/);
  });

  it("CR-4: no names from copyrighted detective series", () => {
    const text = JSON.stringify(CASES);
    for (const name of ["Edogawa", "Kudo", "Shinichi", "Mouri", "Kogoro", "Haibara", "Ai Hai", "Pikachu", "Pokémon"]) {
      assert.equal(text.includes(name), false, name);
    }
  });
});

for (const c of CASES) {
  describe(`case: ${c.title}`, () => {
    it("is valid and provably fair (structure, reachability, assistant solves it)", () => {
      assert.deepEqual(validateCase(c), []);
    });

    it("the assistant solves it with rank S, and every clue is found on the way", () => {
      const { inv, steps } = solve(c);
      assert.equal(inv.status, "solved");
      assert.equal(inv.rank, "S");
      assert.equal(inv.credibility, MAX_CREDIBILITY);
      assert.equal(steps.at(-1).type, "accuse");
      assert.ok(steps.length >= 15, `${steps.length} steps: long enough to be a real case`);
      assert.equal(inv.progress, 1);
    });

    it("has 3–5 scenes, 3–4 witnesses, ≥ 4 deductions and red herrings among the options", () => {
      assert.ok(c.locations.length >= 3 && c.locations.length <= 5);
      assert.ok(c.suspects.length >= 3 && c.suspects.length <= 4);
      assert.ok(c.deductions.length >= 4);
      assert.ok(c.accusation.method.options.length >= 4 && c.accusation.motive.options.length >= 4);
    });

    it("exactly one answer: changing any single part of the accusation is rejected", () => {
      const ready = explore(c);
      const truth = c.accusation;
      const right = { culprit: truth.culprit, method: truth.method.answer, motive: truth.motive.answer, evidence: [truth.evidence].flat()[0] };
      const wrongs = [
        ...c.suspects.filter((s) => s.id !== truth.culprit).map((s) => ({ ...right, culprit: s.id })),
        ...truth.method.options.filter((o) => o.id !== truth.method.answer).map((o) => ({ ...right, method: o.id })),
        ...truth.motive.options.filter((o) => o.id !== truth.motive.answer).map((o) => ({ ...right, motive: o.id })),
        ...ready.found.filter((id) => ![truth.evidence].flat().includes(id)).map((id) => ({ ...right, evidence: id })),
      ];
      for (const answer of wrongs) {
        const inv = new Investigation(c, ready.toJSON());
        const result = inv.accuse(answer);
        assert.equal(result.correct, false, JSON.stringify(answer));
        assert.equal(result.right, 3);
      }
      const inv = new Investigation(c, ready.toJSON());
      assert.equal(inv.accuse(right).correct, true);
    });

    it("every accepted piece of decisive evidence is reachable, and so is every support clue", () => {
      const everything = explore(c);
      for (const id of [c.accusation.evidence, c.support].flat()) assert.ok(everything.has(id), id);
    });

    it("every contradiction needs a clue found elsewhere (no statement proves itself)", () => {
      for (const suspect of c.suspects) {
        for (const statement of suspect.statements) {
          if (!statement.contradiction) continue;
          for (const id of [statement.contradiction.clue].flat()) {
            assert.ok(![statement.gives, statement.contradiction.gives].flat().includes(id), `${suspect.id}/${statement.id}`);
          }
        }
      }
    });

    it("random play never breaks the case, and the assistant can always take over and finish", () => {
      for (let seed = 1; seed <= 40; seed += 1) {
        const rng = mulberry32(seed);
        const inv = new Investigation(c);
        for (let move = 0; move < 60 && inv.status === "investigating"; move += 1) {
          const roll = rng();
          if (roll < 0.4) {
            const location = pick(inv.locations(), rng);
            inv.examine(location.id, pick(inv.hotspots(location.id), rng).id);
          } else if (roll < 0.6) {
            inv.interview(pick(inv.suspects(), rng).id);
          } else if (roll < 0.75 && inv.found.length) {
            const suspect = pick(inv.suspects(), rng);
            const statements = inv.statements(suspect.id);
            if (statements.length) inv.present(suspect.id, pick(statements, rng).id, pick(inv.found, rng));
          } else if (roll < 0.95 && inv.found.length >= 2) {
            inv.deduce(pick(inv.found, rng), pick(inv.found, rng));
          } else if (inv.found.length) {
            inv.accuse({
              culprit: pick(c.suspects, rng).id,
              method: pick(c.accusation.method.options, rng).id,
              motive: pick(c.accusation.motive.options, rng).id,
              evidence: pick(inv.found, rng),
            });
          }
          assert.ok(inv.credibility >= 0 && inv.credibility <= MAX_CREDIBILITY);
          assert.equal(new Set(inv.found).size, inv.found.length);
        }
        if (inv.status !== "investigating") continue;
        // Resume from a save, then let the assistant finish without a single mistake.
        const resumed = new Investigation(c, JSON.parse(JSON.stringify(inv.toJSON())));
        const before = resumed.credibility;
        for (let guard = 0; guard < 200 && resumed.status === "investigating"; guard += 1) {
          const step = nextStep(resumed);
          assert.notEqual(step.type, "stuck", `seed ${seed}: assistant stuck`);
          applyStep(resumed, step);
        }
        assert.equal(resumed.status, "solved", `seed ${seed}`);
        assert.equal(resumed.credibility, before);
      }
    });
  });
}
