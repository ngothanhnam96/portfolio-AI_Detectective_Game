import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCase, validateStructure } from "../src/core/schema.js";
import { explore, nextStep, solve } from "../src/core/solver.js";
import { Investigation } from "../src/core/investigation.js";
import { miniCase } from "./support/mini-case.js";

const errorsFor = (mutate, full = false) => {
  const c = miniCase();
  mutate(c);
  return (full ? validateCase : validateStructure)(c).join("\n");
};

describe("validator", () => {
  it("accepts the mini case", () => {
    assert.deepEqual(validateCase(miniCase()), []);
  });

  it("catches unknown references", () => {
    assert.match(errorsFor((c) => (c.locations[0].hotspots[0].gives = ["nope"])), /không tồn tại: nope/);
    assert.match(errorsFor((c) => (c.suspects[0].statements[0].contradiction.clue = ["ghost"])), /ghost/);
    assert.match(errorsFor((c) => (c.deductions[0].from = ["c_crumbs", "zzz"])), /zzz/);
  });

  it("catches duplicate ids", () => {
    assert.match(errorsFor((c) => c.clues.push({ ...c.clues[0] })), /trùng id: c_brief/);
    assert.match(errorsFor((c) => c.suspects.push({ ...c.suspects[1] })), /nhân vật trùng id: dog/);
  });

  it("catches a clue that nothing produces", () => {
    assert.match(
      errorsFor((c) => c.clues.push({ id: "c_orphan", kind: "evidence", icon: "?", name: "x", text: "x" })),
      /c_orphan không có nguồn/,
    );
  });

  it("catches answers that are missing or not unique", () => {
    assert.match(errorsFor((c) => (c.accusation.method.answer = "m9")), /đáp án phải là đúng một/);
    assert.match(errorsFor((c) => c.accusation.motive.options.push({ id: "o1", text: "x" })), /trùng id o1/);
    assert.match(errorsFor((c) => (c.accusation.culprit = "ghost")), /thủ phạm không phải/);
    assert.match(errorsFor((c) => (c.accusation.method.options = c.accusation.method.options.slice(0, 2))), /ít nhất 3/);
  });

  it("fair play: the culprit must be present from the start", () => {
    assert.match(errorsFor((c) => (c.suspects[0].requires = ["d_cat"])), /thủ phạm phải xuất hiện/);
  });

  it("an adaptation must credit its source", () => {
    assert.match(errorsFor((c) => (c.source = { kind: "adaptation", work: "X" })), /ghi tác phẩm/);
  });

  it("catches a deduction that does not produce a deduction clue", () => {
    assert.match(errorsFor((c) => (c.deductions[0].gives = ["c_lie"])), /loại deduction/);
  });

  it("catches content that can never be reached (circular requirement)", () => {
    const errors = errorsFor((c) => {
      c.locations[0].hotspots[1].requires = ["c_secret"]; // window needs secret, secret needs paw from window
    }, true);
    assert.match(errors, /không thể tìm ra manh mối c_paw/);
  });

  it("catches a case the assistant cannot finish", () => {
    // The cat's statement only appears after its own contradiction: c_lie (support) is unreachable.
    const errors = errorsFor((c) => (c.suspects[0].statements[0].requires = ["c_lie"]), true);
    assert.match(errors, /không thể tìm ra manh mối c_lie/);
    assert.match(errors, /trợ lý không phá được/);
  });
});

describe("solver", () => {
  it("solves the mini case with no mistakes, step by step", () => {
    const { inv, steps } = solve(miniCase());
    assert.equal(inv.status, "solved");
    assert.equal(inv.score, 100);
    assert.deepEqual(
      steps.map((s) => s.type),
      ["examine", "examine", "examine", "interview", "present", "deduce", "accuse"],
    );
  });

  it("does not suggest accusing before the solution is supported", () => {
    const inv = new Investigation(miniCase());
    inv.examine("kitchen", "table");
    inv.examine("kitchen", "window");
    inv.examine("kitchen", "drawer");
    inv.deduce("c_crumbs", "c_paw");
    // c_lie (support) still missing → the assistant points at the cat, not at the accusation
    const step = nextStep(inv);
    assert.equal(step.type, "interview");
  });

  it("reports stuck once everything has been learned (when told not to accuse)", () => {
    const inv = explore(miniCase());
    assert.equal(nextStep(inv, { accuse: false }).type, "stuck");
    assert.equal(nextStep(inv).type, "accuse");
  });
});
