import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CASES } from "../src/core/cases/index.js";
import { portrait } from "../src/ui/portrait.js";

describe("portraits", () => {
  it("every character gets a well-formed, labelled SVG", () => {
    for (const c of CASES) {
      for (const s of c.suspects) {
        const svg = portrait(s.look, { size: 64, title: s.name });
        assert.match(svg, /^<svg class="portrait" viewBox="0 0 64 64"/);
        assert.ok(svg.endsWith("</svg>"));
        assert.ok(svg.includes(`aria-label="${s.name}"`));
        assert.ok(!/NaN|undefined/.test(svg), s.id);
      }
    }
  });

  it("looks change the drawing (hat, glasses, beard, hair)", () => {
    const base = portrait({ hue: 100 });
    for (const look of [{ hat: true }, { glasses: true }, { beard: true }, { hair: "bun" }, { hair: "long" }, { hair: "bald" }]) {
      assert.notEqual(portrait({ hue: 100, ...look }), base, JSON.stringify(look));
    }
  });
});
