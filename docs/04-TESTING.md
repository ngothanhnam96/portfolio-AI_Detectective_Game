# 04 · Testing

```bash
npm test          # node --test, no dependencies
```

63 tests, all deterministic, ~0.2 s.

| File | What it proves | Spec |
|------|----------------|------|
| `investigation.test.js` | Visibility opens as clues are found. Examine/interview are free and give clues once. Right/wrong confrontation and its cost. 5 wrong → case lost and frozen. Deduction in either order, wrong pair costs no credibility. Accusation reports "x/4" without saying which part; 3 wrong → lost. Score and rank bands. Save → restore is identical. A save from another case is rejected | FR-3 – FR-12 |
| `schema.test.js` | The validator catches unknown references, duplicate ids, clues nothing produces, missing or duplicate answers, a culprit hidden at the start, an uncredited adaptation, a wrong deduction kind, circular requirements and an unfinishable case. The solver finishes the mini case in the expected order, doesn't suggest accusing early, and reports "stuck" only when nothing is left | NFR-3, NFR-4 |
| `cases.test.js` | For **each of the 3 cases**: it validates. The assistant solves it at rank S having found 100 % of clues. Changing **any single part** of the accusation is rejected (exactly one answer). Every decisive evidence item and support clue is reachable. No statement proves itself. **40 seeded random play-throughs** (examine, interview, present, deduce, accuse at random) never break, and after a save/restore the assistant always takes over and finishes without a mistake. Plus: unlock order, credit for the Speckled Band, no names from copyrighted series | NFR-3, CR-1 – CR-4 |
| `portrait.test.js` | Every character gets a well-formed, labelled SVG, and each `look` option changes the drawing | NFR-1, NFR-6 |

## Browser end-to-end check (v0.1.0)

Headless Edge driven over the DevTools protocol. The script asks the solver for the next step,
then performs it **with real clicks on the UI** (tabs, places, points, suspects, the confront
dialog, notebook cards, accusation radios).

| Check | Desktop 1280 × 800 | Phone 390 × 844 (touch) |
|-------|--------------------|-------------------------|
| First visit shows "How to play", casebook shows cases 2–3 locked | ✅ | ✅ |
| Wrong confrontation: credibility 5 → 4, "Không có mâu thuẫn" box | ✅ | ✅ |
| Hint: "Ở Gian hàng chính, hãy xem kỹ “Đồng hồ trên sàn”." + "Đi tới" | ✅ | ✅ |
| Case 1 played to the end through the UI (18 steps) → epilogue with rank **A** (1 mistake + 1 hint = 82) | ✅ | ✅ |
| Progress saved (`{"solved":{"dong-ho":"A"}}`), case 2 unlocked, rank stamp on card | ✅ | ✅ |
| Case 2 witnesses and accusation screens render | ✅ | ✅ |
| Horizontal overflow | 0 px | 0 px |
| Console errors / exceptions | none | none |

## Found while testing

| Found | Fix |
|-------|-----|
| One interview could add 3 toasts, and fast play stacked many | One toast per action listing all new clues. Never more than 3 on screen |
| On phones the chosen place/person could be scrolled out of the sideways strip | The active item is scrolled into view after each render |
| A sloppy rank test asserted the wrong band | Rewrote it as an exact table of score → rank for 0–7 hints |
| Screenshots seemed to show toasts that never went away | A DOM check showed they are removed after 3.2 s. Headless screenshots were lagging, not the page |
