import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Investigation, MAX_CREDIBILITY } from "../src/core/investigation.js";
import { RIGHT, miniCase } from "./support/mini-case.js";

const fresh = () => new Investigation(miniCase());
function ready() {
  const inv = fresh();
  inv.examine("kitchen", "table");
  inv.examine("kitchen", "window");
  inv.deduce("c_crumbs", "c_paw");
  return inv;
}

describe("knowledge and visibility", () => {
  it("starts with the briefing clue and full credibility", () => {
    const inv = fresh();
    assert.deepEqual(inv.found, ["c_brief"]);
    assert.equal(inv.credibility, MAX_CREDIBILITY);
    assert.equal(inv.status, "investigating");
    assert.equal(inv.rank, "S");
  });

  it("hides locations, points and suspects until their clues are known", () => {
    const inv = fresh();
    assert.deepEqual(inv.locations().map((l) => l.id), ["kitchen"]);
    assert.deepEqual(inv.hotspots("kitchen").map((h) => h.id), ["table", "window", "stove"]);
    assert.deepEqual(inv.suspects().map((s) => s.id), ["cat", "dog"]);
    inv.examine("kitchen", "window");
    assert.ok(inv.hotspots("kitchen").some((h) => h.id === "drawer"));
    inv.examine("kitchen", "table");
    inv.deduce("c_crumbs", "c_paw");
    assert.ok(inv.location("attic"));
    assert.ok(inv.suspect("mouse"));
  });

  it("refuses to examine hidden points", () => {
    assert.throws(() => fresh().examine("kitchen", "drawer"));
    assert.throws(() => fresh().examine("attic", "box"));
  });
});

describe("examine and interview", () => {
  it("examining adds clues once and is free", () => {
    const inv = fresh();
    const first = inv.examine("kitchen", "table");
    assert.deepEqual(first.gained.map((c) => c.id), ["c_crumbs"]);
    assert.equal(first.again, false);
    const second = inv.examine("kitchen", "table");
    assert.deepEqual(second.gained, []);
    assert.equal(second.again, true);
    assert.equal(inv.score, 100);
    assert.ok(inv.hotspots("kitchen").find((h) => h.id === "table").examined);
  });

  it("points that give nothing still show text and are logged", () => {
    const inv = fresh();
    const result = inv.examine("kitchen", "stove");
    assert.equal(result.text, "Không có gì.");
    assert.equal(inv.log.at(-1).title, "Nhà bếp · Bếp lò");
  });

  it("interviewing adds testimony clues once", () => {
    const inv = fresh();
    assert.deepEqual(inv.interview("cat").gained.map((c) => c.id), ["c_says"]);
    assert.deepEqual(inv.interview("cat").gained, []);
  });
});

describe("confronting statements", () => {
  it("the right clue exposes the contradiction and adds clues", () => {
    const inv = fresh();
    inv.examine("kitchen", "window");
    const result = inv.present("cat", "s1", "c_paw");
    assert.equal(result.correct, true);
    assert.deepEqual(result.gained.map((c) => c.id), ["c_lie"]);
    assert.ok(inv.statements("cat")[0].resolved);
    assert.equal(inv.credibility, MAX_CREDIBILITY);
    assert.equal(inv.present("cat", "s1", "c_paw").already, true);
  });

  it("the wrong clue costs one credibility and lowers the rank", () => {
    const inv = fresh();
    const result = inv.present("cat", "s1", "c_brief");
    assert.equal(result.correct, false);
    assert.equal(inv.credibility, MAX_CREDIBILITY - 1);
    assert.equal(inv.mistakes.present, 1);
    assert.equal(inv.score, 88);
    assert.equal(inv.rank, "A");
  });

  it("statements without a contradiction reject every clue", () => {
    const inv = fresh();
    assert.equal(inv.present("dog", "s1", "c_brief").correct, false);
  });

  it("cannot present a clue you do not have", () => {
    assert.throws(() => fresh().present("cat", "s1", "c_paw"));
  });

  it("five wrong presentations lose the case and freeze it", () => {
    const inv = fresh();
    for (let i = 0; i < 5; i += 1) inv.present("dog", "s1", "c_brief");
    assert.equal(inv.credibility, 0);
    assert.equal(inv.status, "failed");
    assert.throws(() => inv.examine("kitchen", "table"));
  });
});

describe("deductions", () => {
  it("the right pair (in any order) adds the deduction", () => {
    const inv = fresh();
    inv.examine("kitchen", "table");
    inv.examine("kitchen", "window");
    const result = inv.deduce("c_paw", "c_crumbs");
    assert.equal(result.correct, true);
    assert.deepEqual(result.gained.map((c) => c.id), ["d_cat"]);
    assert.equal(inv.deduce("c_crumbs", "c_paw").already, true);
  });

  it("a wrong pair is a mistake but costs no credibility", () => {
    const inv = fresh();
    inv.examine("kitchen", "table");
    assert.equal(inv.deduce("c_brief", "c_crumbs").correct, false);
    assert.equal(inv.deduce("c_brief", "c_brief").correct, false);
    assert.equal(inv.mistakes.deduce, 2);
    assert.equal(inv.credibility, MAX_CREDIBILITY);
    assert.equal(inv.score, 92);
  });

  it("needs both clues in the notebook", () => {
    assert.throws(() => fresh().deduce("c_crumbs", "c_paw"));
  });
});

describe("accusation", () => {
  it("all four parts right solves the case", () => {
    const inv = ready();
    const result = inv.accuse(RIGHT);
    assert.deepEqual(result, { correct: true, right: 4, of: 4 });
    assert.equal(inv.status, "solved");
    assert.equal(inv.rank, "S");
    assert.throws(() => inv.examine("kitchen", "stove"));
  });

  it("a partly wrong accusation tells how many parts were right, not which", () => {
    const inv = ready();
    const result = inv.accuse({ ...RIGHT, motive: "o2" });
    assert.equal(result.correct, false);
    assert.equal(result.right, 3);
    assert.equal(inv.credibility, MAX_CREDIBILITY - 2);
    assert.equal(inv.mistakes.accuse, 1);
    assert.equal(inv.status, "investigating");
    assert.equal(Object.keys(result).includes("parts"), false);
  });

  it("evidence must come from the notebook", () => {
    assert.throws(() => fresh().accuse(RIGHT));
  });

  it("three wrong accusations lose the case", () => {
    const inv = ready();
    inv.accuse({ ...RIGHT, culprit: "dog" });
    inv.accuse({ ...RIGHT, culprit: "dog" });
    const last = inv.accuse({ ...RIGHT, culprit: "dog" });
    assert.equal(last.failed, true);
    assert.equal(inv.status, "failed");
  });
});

describe("scoring and persistence", () => {
  it("hints lower the score", () => {
    const inv = fresh();
    inv.useHint();
    inv.useHint();
    assert.equal(inv.score, 88);
    assert.equal(inv.rank, "A");
  });

  it("rank bands: S ≥ 95, A ≥ 80, B ≥ 60, else C", () => {
    const inv = fresh();
    const ranks = [];
    for (let i = 0; i < 8; i += 1) {
      ranks.push(`${inv.score}${inv.rank}`);
      inv.useHint();
    }
    assert.deepEqual(ranks, ["100S", "94A", "88A", "82A", "76B", "70B", "64B", "58C"]);
  });

  it("progress counts found clues", () => {
    const inv = ready();
    assert.equal(inv.progress, 4 / 7);
  });

  it("toJSON → restore gives an identical investigation", () => {
    const inv = ready();
    inv.interview("cat");
    inv.present("dog", "s1", "c_brief");
    inv.useHint();
    const copy = new Investigation(miniCase(), JSON.parse(JSON.stringify(inv)));
    assert.deepEqual(copy.toJSON(), inv.toJSON());
    assert.equal(copy.score, inv.score);
    assert.ok(copy.location("attic"));
  });

  it("rejects a save from another case", () => {
    const saved = { ...fresh().toJSON(), caseId: "other" };
    assert.throws(() => new Investigation(miniCase(), saved));
  });
});
