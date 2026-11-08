/**
 * The scene map: every location of the case drawn as a room on a floor plan. The room being
 * inspected is highlighted, and each of its points of interest is a numbered marker at its
 * real position, numbered like the buttons in the list. Pure string output (no DOM), so it is
 * tested in Node. The map is a visual aid: everything on it is also in the list next to it.
 */

import { PLAN_H, PLAN_W, hasPlan, percent, spotPoint } from "../core/floorplan.js";

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const pct = (value) => `${Math.round(value * 100) / 100}%`;

function box([x, y, w, h]) {
  return `left:${pct((x / PLAN_W) * 100)};top:${pct((y / PLAN_H) * 100)};width:${pct((w / PLAN_W) * 100)};height:${pct((h / PLAN_H) * 100)}`;
}

/**
 * @param data      the case
 * @param inv       its Investigation (which places and points are open, which are examined)
 * @param selected  id of the location being inspected
 * @param recent    id of the point examined last, to make its marker pulse
 */
export function floorplan(data, inv, selected, { recent = null } = {}) {
  if (!hasPlan(data)) return "";
  const open = new Set(inv.locations().map((l) => l.id));
  const here = data.locations.find((l) => l.id === selected);
  const rooms = [];
  const markers = [];

  for (const location of data.locations) {
    if (!open.has(location.id)) {
      rooms.push(`<div class="room locked" style="${box(location.area)}"><span class="room-name">?</span></div>`);
      continue;
    }
    const active = location.id === selected;
    const spots = inv.hotspots(location.id);
    const done = spots.filter((s) => s.examined).length;
    // The room being inspected carries no label: its name is above the map, so markers never cover it.
    const label = active ? "" : `<span class="room-name"><span class="room-icon">${location.icon}</span> ${esc(location.name)}</span><span class="room-meta">${done}/${spots.length}</span>`;
    rooms.push(`<button type="button" class="room${active ? " active" : ""}${done === spots.length ? " cleared" : ""}" style="${box(location.area)}" data-action="location" data-id="${location.id}" tabindex="-1" title="${esc(location.name)}">${label}</button>`);

    spots.forEach((spot, index) => {
      const [left, top] = percent(spotPoint(location.area, spot.at));
      const where = `left:${pct(left)};top:${pct(top)}`;
      if (active) {
        markers.push(`<button type="button" class="marker${spot.examined ? " examined" : ""}${spot.id === recent ? " recent" : ""}" style="${where}" data-action="examine" data-id="${spot.id}" data-marker="${spot.id}" tabindex="-1" title="${index + 1}. ${esc(spot.name)}">${index + 1}</button>`);
      } else {
        markers.push(`<span class="pin${spot.examined ? " examined" : ""}" style="${where}"></span>`);
      }
    });
  }

  const labels = (data.map?.labels ?? []).map((label) =>
    `<span class="plan-label" style="left:${pct((label.x / PLAN_W) * 100)};top:${pct((label.y / PLAN_H) * 100)}">${esc(label.text)}</span>`);

  return `
    <figure class="floorplan" aria-hidden="true">
      <p class="plan-here">📍 Đang xem: <strong>${esc(here?.name ?? "")}</strong></p>
      <div class="plan" style="aspect-ratio:${PLAN_W} / ${PLAN_H}">${rooms.join("")}${labels.join("")}${markers.join("")}</div>
      <figcaption>🗺️ Sơ đồ hiện trường · số trên sơ đồ là các điểm cần xem xét</figcaption>
    </figure>`;
}
