/**
 * The assistant: finds the next useful action in an investigation. The same logic powers the
 * in-game hint button and the tests that prove every case can be solved fairly.
 */

import { Investigation } from "./investigation.js";

const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/**
 * Next useful step, in the order a careful detective works:
 * look where something new can be found → confront a lie you can prove → combine clues →
 * accuse once the whole solution is supported.
 * Returns { type: "examine" | "present" | "deduce" | "accuse" | "stuck", ... }.
 */
export function nextStep(inv, { accuse = true } = {}) {
  for (const location of inv.locations()) {
    for (const spot of inv.hotspots(location.id)) {
      if (!spot.examined && list(spot.gives).some((id) => !inv.has(id))) {
        return { type: "examine", location: location.id, hotspot: spot.id };
      }
    }
  }
  for (const suspect of inv.suspects()) {
    if (inv.statements(suspect.id).some((s) => list(s.gives).some((id) => !inv.has(id)))) {
      return { type: "interview", suspect: suspect.id };
    }
  }
  for (const suspect of inv.suspects()) {
    for (const statement of inv.statements(suspect.id)) {
      if (statement.resolved || !statement.contradiction) continue;
      const clue = list(statement.contradiction.clue).find((id) => inv.has(id));
      if (clue) return { type: "present", suspect: suspect.id, statement: statement.id, clue };
    }
  }
  for (const deduction of inv.case.deductions) {
    if (!inv.deduced.has(deduction.id) && deduction.from.every((id) => inv.has(id))) {
      return { type: "deduce", deduction: deduction.id, from: [...deduction.from] };
    }
  }
  const truth = inv.case.accusation;
  const ready = list(inv.case.support).every((id) => inv.has(id));
  const evidence = list(truth.evidence).find((id) => inv.has(id));
  if (accuse && ready && evidence) {
    return {
      type: "accuse",
      answer: { culprit: truth.culprit, method: truth.method.answer, motive: truth.motive.answer, evidence },
    };
  }
  return { type: "stuck" };
}

export function applyStep(inv, step) {
  if (step.type === "examine") return inv.examine(step.location, step.hotspot);
  if (step.type === "interview") return inv.interview(step.suspect);
  if (step.type === "present") return inv.present(step.suspect, step.statement, step.clue);
  if (step.type === "deduce") return inv.deduce(...step.from);
  if (step.type === "accuse") return inv.accuse(step.answer);
  throw new Error(`Không áp dụng được bước ${step.type}`);
}

/** Plays the case with the assistant only. Returns the investigation and the steps taken. */
export function solve(caseData, { maxSteps = 500 } = {}) {
  const inv = new Investigation(caseData);
  const steps = [];
  while (inv.status === "investigating" && steps.length < maxSteps) {
    const step = nextStep(inv);
    if (step.type === "stuck") break;
    applyStep(inv, step);
    steps.push(step);
  }
  return { inv, steps };
}

/**
 * Explores everything that can ever be learned without accusing: every clue, point of
 * interest, statement and contradiction. Used to prove there is no unreachable content.
 */
export function explore(caseData) {
  const inv = new Investigation(caseData);
  for (let guard = 0; guard < 1000; guard += 1) {
    const step = nextStep(inv, { accuse: false });
    if (step.type === "stuck") break;
    applyStep(inv, step);
  }
  // Also look at points that give nothing, so they count as reachable.
  for (const location of inv.locations()) {
    for (const spot of inv.hotspots(location.id)) if (!spot.examined) inv.examine(location.id, spot.id);
  }
  return inv;
}
