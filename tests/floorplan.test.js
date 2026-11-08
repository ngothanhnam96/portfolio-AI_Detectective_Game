import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CASES } from "../src/core/cases/index.js";
import { MIN_SPOT_GAP, PLAN_H, PLAN_W, hasPlan, planErrors, spotPoint } from "../src/core/floorplan.js";
import { Investigation } from "../src/core/investigation.js";
import { validateStructure } from "../src/core/schema.js";
import { explore } from "../src/core/solver.js";
import { floorplan } from "../src/ui/floorplan.js";
import { miniCase } from "./support/mini-case.js";

const clone = (value) => structuredClone(value);
const markerIds = (html) => [...html.matchAll(/data-marker="([^"]+)"/g)].map((m) => m[1]);
const style = (html, attr, id) => html.match(new RegExp(`<[^>]*${attr}="${id}"[^>]*style="([^"]+)"|<[^>]*style="([^"]+)"[^>]*${attr}="${id}"`));

describe("scene map: case data", () => {
  it("every case has a complete, tidy floor plan", () => {
    for (const c of CASES) {
      assert.ok(hasPlan(c), c.id);
      assert.deepEqual(planErrors(c), [], c.id);
      for (const l of c.locations) {
        assert.equal(l.area.length, 4, `${c.id}/${l.id}`);
        for (const h of l.hotspots) assert.equal(h.at.length, 2, `${c.id}/${l.id}/${h.id}`);
      }
    }
  });

  it("every marker lies inside its own room and no other", () => {
    for (const c of CASES) {
      for (const l of c.locations) {
        for (const h of l.hotspots) {
          const [x, y] = spotPoint(l.area, h.at);
          const inside = c.locations.filter(({ area: [rx, ry, rw, rh] }) => x > rx && x < rx + rw && y > ry && y < ry + rh);
          assert.deepEqual(inside.map((r) => r.id), [l.id], `${c.id}/${l.id}/${h.id}`);
          assert.ok(x > 0 && x < PLAN_W && y > 0 && y < PLAN_H);
        }
      }
    }
  });

  it("places the story's details where the text says they are", () => {
    const at = (caseId, loc, spot) => {
      const l = CASES.find((c) => c.id === caseId).locations.find((x) => x.id === loc);
      return spotPoint(l.area, l.hotspots.find((h) => h.id === spot).at);
    };
    const room = (caseId, loc) => CASES.find((c) => c.id === caseId).locations.find((x) => x.id === loc).area;
    // Speckled Band: the ventilator is on the wall Julia's room shares with the doctor's room,
    // and the doctor's chair stands right under it, on the other side.
    const julia = room("dai-bang", "julia");
    const doctor = room("dai-bang", "doctor");
    assert.equal(doctor[0] + doctor[2], julia[0], "the two rooms share a wall");
    assert.ok(at("dai-bang", "julia", "ventilator")[0] - julia[0] < 5);
    assert.ok(julia[0] - at("dai-bang", "doctor", "chair")[0] < 5);
    // Locked room: the key and the gap are at the study door, next to the hall's threshold.
    const study = room("phong-khoa", "study");
    for (const spot of ["lock", "gap"]) assert.ok(study[0] + study[2] - at("phong-khoa", "study", spot)[0] < 4, spot);
    assert.ok(at("phong-khoa", "hall", "threshold")[0] - study[0] - study[2] < 3);
  });
});

describe("scene map: validator", () => {
  const withPlan = () => {
    const c = miniCase();
    c.locations.forEach((l, i) => {
      l.area = [5 + i * 32, 5, 30, 50];
      l.hotspots.forEach((h, j) => { h.at = [20 + (j % 2) * 60, 15 + Math.floor(j / 2) * 25]; });
    });
    return c;
  };

  it("accepts a case without a plan (the plan is optional) and a tidy one", () => {
    assert.deepEqual(planErrors(miniCase()), []);
    assert.deepEqual(planErrors(withPlan()), []);
    assert.deepEqual(validateStructure(withPlan()), []);
  });

  it("rejects missing coordinates, rooms outside or overlapping, markers on walls or crowded", () => {
    const expect = (change, pattern) => {
      const c = withPlan();
      change(c);
      assert.ok(validateStructure(c).some((e) => pattern.test(e)), `${pattern}: ${validateStructure(c)}`);
    };
    expect((c) => delete c.locations[1].area, /thiếu area/);
    expect((c) => delete c.locations[0].hotspots[0].at, /thiếu at/);
    expect((c) => { c.locations[0].area = [90, 5, 20, 20]; }, /ngoài khung/);
    expect((c) => { c.locations[1].area = [10, 10, 20, 20]; }, /chồng lên/);
    expect((c) => { c.locations[0].area = [5, 5, 4, 20]; }, /quá nhỏ/);
    expect((c) => { c.locations[0].hotspots[0].at = [100, 50]; }, /sát tường/);
    expect((c) => {
      const spots = c.locations[0].hotspots;
      if (spots.length < 2) spots.push({ id: "extra", name: "Thêm", text: "…" });
      spots[0].at = [50, 50];
      spots[1].at = [52, 52];
    }, /quá gần/);
    expect((c) => { c.map = { labels: [{ text: "Phố", x: 200, y: 10 }] }; }, /nhãn/);
  });

  it("markers are at least the minimum gap apart in every case", () => {
    for (const c of CASES) {
      for (const l of c.locations) {
        const points = l.hotspots.map((h) => spotPoint(l.area, h.at));
        for (let i = 0; i < points.length; i++) {
          for (let j = i + 1; j < points.length; j++) {
            assert.ok(Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) >= MIN_SPOT_GAP, `${c.id}/${l.id}`);
          }
        }
      }
    }
  });
});

describe("scene map: drawing", () => {
  it("highlights the room being inspected and numbers its points like the list", () => {
    for (const c of CASES) {
      const inv = new Investigation(c);
      for (const location of inv.locations()) {
        const html = floorplan(c, inv, location.id);
        assert.equal((html.match(/class="room active/g) ?? []).length, 1, `${c.id}/${location.id}`);
        assert.match(html, new RegExp(`class="room active[^"]*"[^>]*data-id="${location.id}"`));
        const spots = inv.hotspots(location.id);
        assert.deepEqual(markerIds(html), spots.map((s) => s.id));
        spots.forEach((s, i) => assert.ok(html.includes(`title="${i + 1}. ${s.name.replace(/&/g, "&amp;")}"`), s.id));
        assert.ok(!/NaN|undefined/.test(html), c.id);
      }
    }
  });

  it("puts each marker at its computed position", () => {
    const c = CASES.find((x) => x.id === "phong-khoa");
    const inv = new Investigation(c);
    const html = floorplan(c, inv, "study");
    const study = c.locations.find((l) => l.id === "study");
    for (const spot of study.hotspots) {
      const [x, y] = spotPoint(study.area, spot.at);
      const css = style(html, "data-marker", spot.id);
      assert.ok(css, spot.id);
      const value = css[1] ?? css[2];
      assert.ok(value.includes(`left:${Math.round((x / PLAN_W) * 10000) / 100}%`), `${spot.id}: ${value}`);
      assert.ok(value.includes(`top:${Math.round((y / PLAN_H) * 10000) / 100}%`), `${spot.id}: ${value}`);
    }
  });

  it("marks examined points and the most recent one, and hides places not yet open", () => {
    const c = CASES.find((x) => x.id === "dai-bang");
    const inv = new Investigation(c);
    inv.examine("julia", "bed");
    const html = floorplan(c, inv, "julia", { recent: "bed" });
    assert.match(html, /class="marker examined recent"[^>]*data-id="bed"/);
    assert.match(html, /class="room locked"/, "London is not open at the start");
    assert.ok(!html.includes('data-id="london"'));

    const all = explore(c);
    const late = floorplan(c, all, "london");
    assert.match(late, /class="room active[^"]*"[^>]*data-id="london"/);
    assert.ok(!late.includes("room locked"));
  });

  it("draws nothing for a case without a plan", () => {
    const c = miniCase();
    assert.equal(floorplan(c, new Investigation(c), c.locations[0].id), "");
  });

  it("escapes names", () => {
    const c = clone(CASES[0]);
    c.locations[0].name = `<b>"x"</b>`;
    const html = floorplan(c, new Investigation(c), c.locations[0].id);
    assert.ok(!html.includes("<b>"));
    assert.ok(html.includes("&lt;b&gt;"));
  });
});
