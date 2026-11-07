/**
 * Code-drawn suspect portraits: a noir head-and-shoulders silhouette coloured from the
 * character's `look` (hue, hair, glasses, hat, beard). Returns an SVG string. No DOM.
 */

const SKIN = ["#f1c9a5", "#e0ac84", "#c98e63"];

function hairShape(kind, color) {
  switch (kind) {
    case "bald":
      return `<path d="M21 27 q-1 -6 3 -8 M43 27 q1 -6 -3 -8" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    case "long":
      return `<path d="M19 30 q-2 -15 13 -16 q15 1 13 16 l2 16 q-4 3 -6 0 l-1 -14 q-8 -6 -16 0 l-1 14 q-2 3 -6 0 z" fill="${color}"/>`;
    case "bun":
      return `<circle cx="32" cy="12" r="5" fill="${color}"/><path d="M20 28 q0 -13 12 -13 q12 0 12 13 q-6 -6 -12 -6 q-6 0 -12 6 z" fill="${color}"/>`;
    case "slick":
      return `<path d="M20 27 q0 -13 12 -13 q13 0 12 12 q-9 -7 -24 1 z" fill="${color}"/>`;
    case "messy":
      return `<path d="M19 28 l1 -9 l4 3 l2 -7 l4 4 l3 -6 l3 6 l4 -4 l2 7 l4 -3 l1 9 q-12 -7 -28 0 z" fill="${color}"/>`;
    case "scarf":
      return `<path d="M18 30 q0 -17 14 -17 q14 0 14 17 l-2 4 q-1 -14 -12 -14 q-11 0 -12 14 z" fill="${color}"/><circle cx="25" cy="20" r="1.2" fill="#fff"/><circle cx="34" cy="17" r="1.2" fill="#fff"/><circle cx="40" cy="23" r="1.2" fill="#fff"/>`;
    case "grey":
    case "short":
    default:
      return `<path d="M20 28 q-1 -14 12 -14 q13 0 12 14 q-3 -6 -12 -7 q-9 1 -12 7 z" fill="${color}"/>`;
  }
}

export function portrait(look = {}, { size = 64, title = "" } = {}) {
  const hue = look.hue ?? 210;
  const skin = SKIN[Math.abs(Math.round(hue / 47)) % SKIN.length];
  const hairColor = look.hair === "grey" ? "#b9b9c0" : `hsl(${(hue + 25) % 360} 25% 18%)`;
  const coat = `hsl(${hue} 32% 34%)`;
  const backdrop = `hsl(${hue} 30% 82%)`;
  const parts = [
    `<rect width="64" height="64" rx="12" fill="${backdrop}"/>`,
    `<path d="M8 64 q2 -16 24 -18 q22 2 24 18 z" fill="${coat}"/>`,
    `<path d="M26 47 l6 8 l6 -8" fill="#f4f1ea"/>`,
    `<rect x="28" y="38" width="8" height="8" fill="${skin}"/>`,
    `<ellipse cx="32" cy="29" rx="11" ry="13" fill="${skin}"/>`,
    hairShape(look.hair, hairColor),
    `<circle cx="27.5" cy="30" r="1.4" fill="#2a2522"/><circle cx="36.5" cy="30" r="1.4" fill="#2a2522"/>`,
    `<path d="M29 36 q3 1.6 6 0" stroke="#7a4a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  ];
  if (look.beard) parts.push(`<path d="M22 32 q1 12 10 12 q9 0 10 -12 q-3 5 -10 5 q-7 0 -10 -5 z" fill="${hairColor}"/>`);
  if (look.glasses) {
    parts.push(`<g stroke="#222" stroke-width="1.1" fill="rgba(255,255,255,.25)"><circle cx="27.5" cy="30" r="3.6"/><circle cx="36.5" cy="30" r="3.6"/><path d="M31 30 h2" fill="none"/></g>`);
  }
  if (look.hat) {
    parts.push(`<path d="M16 21 h32 l-3 -2 h-3 q0 -9 -10 -9 q-10 0 -10 9 h-3 z" fill="hsl(${hue} 20% 16%)"/><rect x="22" y="16" width="20" height="2.4" fill="hsl(${hue} 40% 40%)"/>`);
  }
  const label = title ? `<title>${title}</title>` : "";
  return `<svg class="portrait" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg">${label}${parts.join("")}</svg>`;
}
