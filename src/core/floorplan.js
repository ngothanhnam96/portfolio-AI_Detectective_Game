/**
 * Floor-plan geometry (pure, no DOM). A case may draw its locations on a 100 × 64 plan:
 *   location.area = [x, y, w, h]   in plan units
 *   hotspot.at    = [x, y]         in percent of its room (0–100)
 *   map.labels    = [{ text, x, y }] street names and similar notes, in plan units
 */

export const PLAN_W = 100;
export const PLAN_H = 64;
export const MIN_ROOM = 8; // smallest room side, in plan units
export const SPOT_MARGIN = 5; // markers stay this far (percent) from a room's walls
export const MIN_SPOT_GAP = 7; // markers in one room stay this far apart (plan units), so they never overlap

const isNum = (value) => typeof value === "number" && Number.isFinite(value);

/** Where a hotspot sits on the whole plan, in plan units. */
export function spotPoint(area, at) {
  const [x, y, w, h] = area;
  return [x + (at[0] / 100) * w, y + (at[1] / 100) * h];
}

/** Plan coordinates as CSS percentages of the plan box. */
export const percent = ([x, y]) => [(x / PLAN_W) * 100, (y / PLAN_H) * 100];

export const hasPlan = (c) => c.locations.some((l) => l.area !== undefined);

function overlaps(a, b) {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

/** Every problem with a case's floor plan, as readable strings. A case with no plan has none. */
export function planErrors(c) {
  if (!hasPlan(c)) return [];
  const errors = [];
  const rooms = [];
  for (const location of c.locations) {
    const { area } = location;
    if (!Array.isArray(area) || area.length !== 4 || !area.every(isNum)) {
      errors.push(`sơ đồ: ${location.id} thiếu area [x, y, w, h]`);
      continue;
    }
    const [x, y, w, h] = area;
    if (w < MIN_ROOM || h < MIN_ROOM) errors.push(`sơ đồ: ${location.id} quá nhỏ`);
    if (x < 0 || y < 0 || x + w > PLAN_W || y + h > PLAN_H) errors.push(`sơ đồ: ${location.id} nằm ngoài khung`);
    for (const other of rooms) if (overlaps(area, other.area)) errors.push(`sơ đồ: ${location.id} chồng lên ${other.id}`);
    rooms.push(location);

    const points = [];
    for (const spot of location.hotspots) {
      const { at } = spot;
      if (!Array.isArray(at) || at.length !== 2 || !at.every(isNum)) {
        errors.push(`sơ đồ: ${location.id}/${spot.id} thiếu at [x, y]`);
        continue;
      }
      if (at.some((v) => v < SPOT_MARGIN || v > 100 - SPOT_MARGIN)) errors.push(`sơ đồ: ${location.id}/${spot.id} sát tường hoặc ra ngoài phòng`);
      const point = spotPoint(area, at);
      for (const other of points) {
        if (Math.hypot(point[0] - other.point[0], point[1] - other.point[1]) < MIN_SPOT_GAP) {
          errors.push(`sơ đồ: ${location.id}/${spot.id} quá gần ${other.id}`);
        }
      }
      points.push({ id: spot.id, point });
    }
  }
  for (const label of c.map?.labels ?? []) {
    if (typeof label.text !== "string" || !isNum(label.x) || !isNum(label.y)) errors.push("sơ đồ: nhãn không hợp lệ");
    else if (label.x < 0 || label.x > PLAN_W || label.y < 0 || label.y > PLAN_H) errors.push(`sơ đồ: nhãn “${label.text}” nằm ngoài khung`);
  }
  return errors;
}
