/** The casebook, in play order. A case unlocks when the previous one is solved. */

import daiBang from "./dai-bang.js";
import dongHo from "./dong-ho.js";
import phongKhoa from "./phong-khoa.js";

export const CASES = [dongHo, daiBang, phongKhoa];

export function caseById(id) {
  return CASES.find((c) => c.id === id) ?? null;
}

/** A case is open if it is the first, or the one before it has been solved. */
export function isUnlocked(id, solvedIds) {
  const index = CASES.findIndex((c) => c.id === id);
  return index === 0 || (index > 0 && solvedIds.includes(CASES[index - 1].id));
}
