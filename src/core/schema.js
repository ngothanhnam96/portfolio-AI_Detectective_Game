/**
 * Case data validation: structure, unique ids, references, exactly one answer, and the
 * fair-play rules (see docs/00-RESEARCH.md). Returns a list of human-readable errors.
 */

import { explore, solve } from "./solver.js";

const CLUE_KINDS = ["evidence", "testimony", "deduction"];
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const paragraphs = (value) => Array.isArray(value) && value.length > 0 && value.every(text);

function duplicates(ids) {
  const seen = new Set();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

/** Structural checks only (fast, no play-through). */
export function validateStructure(c) {
  const errors = [];
  const fail = (message) => errors.push(`${c.id ?? "?"}: ${message}`);

  for (const field of ["id", "title", "subtitle", "setting"]) if (!text(c[field])) fail(`thiếu ${field}`);
  if (![1, 2, 3].includes(c.difficulty)) fail("difficulty phải là 1–3");
  if (!paragraphs(c.intro)) fail("intro phải là danh sách đoạn văn");
  if (!paragraphs(c.epilogue)) fail("epilogue phải là danh sách đoạn văn");
  if (!c.source || !["original", "adaptation"].includes(c.source.kind)) fail("source.kind không hợp lệ");
  if (c.source?.kind === "adaptation" && !(text(c.source.work) && text(c.source.author) && text(c.source.url))) {
    fail("bản phỏng theo phải ghi tác phẩm, tác giả và nguồn");
  }

  // Clues
  const clueIds = new Set(c.clues.map((clue) => clue.id));
  for (const id of duplicates(c.clues.map((clue) => clue.id))) fail(`manh mối trùng id: ${id}`);
  for (const clue of c.clues) {
    if (!text(clue.name) || !text(clue.text) || !text(clue.icon)) fail(`manh mối ${clue.id} thiếu tên/mô tả/biểu tượng`);
    if (!CLUE_KINDS.includes(clue.kind)) fail(`manh mối ${clue.id} có loại không hợp lệ`);
  }
  const ref = (ids, where) => {
    for (const id of list(ids)) if (!clueIds.has(id)) fail(`${where} tham chiếu manh mối không tồn tại: ${id}`);
  };
  ref(c.start, "start");

  // Sources of every clue
  const given = new Set(list(c.start));
  const give = (ids) => list(ids).forEach((id) => given.add(id));

  // Locations
  for (const id of duplicates(c.locations.map((l) => l.id))) fail(`địa điểm trùng id: ${id}`);
  for (const location of c.locations) {
    if (!text(location.name) || !text(location.description) || !text(location.icon)) fail(`địa điểm ${location.id} thiếu nội dung`);
    ref(location.requires, `địa điểm ${location.id}`);
    for (const id of duplicates(location.hotspots.map((h) => h.id))) fail(`${location.id}: điểm trùng id ${id}`);
    for (const spot of location.hotspots) {
      if (!text(spot.name) || !text(spot.text)) fail(`${location.id}/${spot.id} thiếu nội dung`);
      ref(spot.requires, `${location.id}/${spot.id}`);
      ref(spot.gives, `${location.id}/${spot.id}`);
      give(spot.gives);
    }
  }

  // Suspects
  for (const id of duplicates(c.suspects.map((s) => s.id))) fail(`nhân vật trùng id: ${id}`);
  for (const suspect of c.suspects) {
    if (!text(suspect.name) || !text(suspect.role) || !text(suspect.bio)) fail(`nhân vật ${suspect.id} thiếu nội dung`);
    if (!suspect.look || typeof suspect.look.hue !== "number") fail(`nhân vật ${suspect.id} thiếu look.hue`);
    ref(suspect.requires, `nhân vật ${suspect.id}`);
    for (const id of duplicates(suspect.statements.map((s) => s.id))) fail(`${suspect.id}: lời khai trùng id ${id}`);
    for (const statement of suspect.statements) {
      const where = `${suspect.id}/${statement.id}`;
      if (!text(statement.text)) fail(`${where} thiếu nội dung`);
      ref(statement.requires, where);
      ref(statement.gives, where);
      give(statement.gives);
      if (statement.contradiction) {
        const { clue, reply, gives } = statement.contradiction;
        if (list(clue).length === 0) fail(`${where}: mâu thuẫn cần ít nhất một manh mối`);
        if (!text(reply)) fail(`${where}: mâu thuẫn thiếu lời đáp`);
        ref(clue, where);
        ref(gives, where);
        give(gives);
      }
    }
  }

  // Deductions
  const pairs = new Set();
  for (const id of duplicates(c.deductions.map((d) => d.id))) fail(`suy luận trùng id: ${id}`);
  for (const deduction of c.deductions) {
    const where = `suy luận ${deduction.id}`;
    if (deduction.from.length !== 2 || deduction.from[0] === deduction.from[1]) fail(`${where} phải ghép đúng hai manh mối khác nhau`);
    const key = [...deduction.from].sort().join("+");
    if (pairs.has(key)) fail(`${where}: cặp manh mối đã được dùng`);
    pairs.add(key);
    if (!text(deduction.text)) fail(`${where} thiếu nội dung`);
    ref(deduction.from, where);
    ref(deduction.gives, where);
    give(deduction.gives);
    for (const id of list(deduction.gives)) {
      if (clueIds.has(id) && c.clues.find((clue) => clue.id === id).kind !== "deduction") fail(`${where} phải tạo manh mối loại deduction`);
    }
  }

  for (const id of clueIds) if (!given.has(id)) fail(`manh mối ${id} không có nguồn nào tạo ra`);

  // Accusation: exactly one answer per question
  const truth = c.accusation;
  const suspectIds = c.suspects.map((s) => s.id);
  if (!suspectIds.includes(truth.culprit)) fail("thủ phạm không phải là một nhân vật");
  for (const part of ["method", "motive"]) {
    const options = truth[part].options;
    if (options.length < 3) fail(`${part} cần ít nhất 3 lựa chọn`);
    for (const id of duplicates(options.map((o) => o.id))) fail(`${part}: lựa chọn trùng id ${id}`);
    if (options.filter((o) => o.id === truth[part].answer).length !== 1) fail(`${part}: đáp án phải là đúng một lựa chọn`);
    if (!options.every((o) => text(o.text))) fail(`${part}: lựa chọn thiếu nội dung`);
  }
  if (list(truth.evidence).length === 0) fail("cần ít nhất một chứng cứ quyết định");
  ref(truth.evidence, "accusation.evidence");
  ref(c.support, "support");
  if (list(c.support).length === 0) fail("support (cơ sở của lời giải) không được rỗng");

  // Fair play: the culprit is present from the start
  const culprit = c.suspects.find((s) => s.id === truth.culprit);
  if (culprit && list(culprit.requires).length) fail("luật chơi đẹp: thủ phạm phải xuất hiện ngay từ đầu");

  return errors;
}

/** Full validation: structure, then play-throughs proving fairness. */
export function validateCase(c) {
  const errors = validateStructure(c);
  if (errors.length) return errors;
  const fail = (message) => errors.push(`${c.id}: ${message}`);

  const everything = explore(c);
  for (const clue of c.clues) if (!everything.has(clue.id)) fail(`không thể tìm ra manh mối ${clue.id}`);
  for (const location of c.locations) {
    if (!everything.location(location.id)) fail(`không thể tới địa điểm ${location.id}`);
    for (const spot of location.hotspots) {
      if (!everything.examined.has(`${location.id}/${spot.id}`)) fail(`không thể xem ${location.id}/${spot.id}`);
    }
  }
  for (const suspect of c.suspects) {
    if (!everything.suspect(suspect.id)) fail(`không thể gặp ${suspect.id}`);
    for (const statement of suspect.statements) {
      const key = `${suspect.id}/${statement.id}`;
      if (!everything.statements(suspect.id).some((s) => s.id === statement.id)) fail(`không thể nghe lời khai ${key}`);
      if (statement.contradiction && !everything.resolved.has(key)) fail(`không thể vạch mâu thuẫn ${key}`);
    }
  }
  for (const deduction of c.deductions) if (!everything.deduced.has(deduction.id)) fail(`không thể suy luận ${deduction.id}`);

  const { inv } = solve(c);
  if (inv.status !== "solved") fail("trợ lý không phá được vụ án từ đầu");
  else if (inv.rank !== "S" || inv.credibility !== 5) fail("lời giải chuẩn phải không có lỗi nào");
  return errors;
}
