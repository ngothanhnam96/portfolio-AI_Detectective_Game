# 04 · Testing

```bash
npm test          # node --test, no dependencies
```

80 tests, all deterministic, ~0.3 s.

| File | What it proves | Spec |
|------|----------------|------|
| `investigation.test.js` | Visibility opens as clues are found. Examine/interview are free and give clues once. Right/wrong confrontation and its cost. 5 wrong → case lost and frozen. Deduction in either order, wrong pair costs no credibility. Accusation reports "x/4" without saying which part; 3 wrong → lost. Score and rank bands. Save → restore is identical. A save from another case is rejected | FR-3 – FR-12 |
| `schema.test.js` | The validator catches unknown references, duplicate ids, clues nothing produces, missing or duplicate answers, a culprit hidden at the start, an uncredited adaptation, a wrong deduction kind, circular requirements and an unfinishable case. The solver finishes the mini case in the expected order, doesn't suggest accusing early, and reports "stuck" only when nothing is left | NFR-3, NFR-4 |
| `cases.test.js` | For **each of the 3 cases**: it validates. The assistant solves it at rank S having found 100 % of clues. Changing **any single part** of the accusation is rejected (exactly one answer). Every decisive evidence item and support clue is reachable. No statement proves itself. **40 seeded random play-throughs** (examine, interview, present, deduce, accuse at random) never break, and after a save/restore the assistant always takes over and finishes without a mistake. Plus: unlock order, credit for the Speckled Band, no names from copyrighted series | NFR-3, CR-1 – CR-4 |
| `portrait.test.js` | Every character gets a well-formed, labelled SVG, and each `look` option changes the drawing | NFR-1, NFR-6 |
| `floorplan.test.js` | Every case has a complete plan. **Every marker lies inside its own room and no other**, and markers are at least 7 units apart. Story facts hold on the map (the Speckled Band ventilator is on the shared wall with the doctor's chair right under it; the locked-room key and door gap are at the study door next to the hall threshold). The validator rejects missing coordinates, rooms outside the frame, overlapping or tiny rooms, markers on walls or crowded, bad labels, and accepts a case with no plan. The drawing highlights exactly one room, numbers the markers like the list, puts each one at its computed position, marks examined and recent points, hides places not yet open, and escapes names | FR-15, NFR-4 |
| `speech.test.js` | Spoken text drops emoji, quote marks and symbols but keeps every Vietnamese letter. Parts become sentences. Long text is split at sentence boundaries with no word lost, for every case's intro and epilogue. **All text in all 3 cases** becomes clean speech. The voice choice prefers a natural Vietnamese voice, then any `vi` voice, else none. Without speech support nothing is spoken and nothing throws | FR-16 |

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

## Browser check of the scene map and read-aloud (v0.2.0)

Headless Edge with **real mouse events** and a spy on `speechSynthesis.speak` that records every
utterance (`det-a11y.mjs`).

| Check | Desktop 1280 × 800 | Phone 390 × 844 (touch) |
|-------|--------------------|-------------------------|
| Vietnamese voices found | "Microsoft Hoài My Online (Natural)", "Microsoft Nam Minh Online (Natural)" | same |
| Turn on read-aloud → "Đã bật đọc to…" spoken; briefing then read in full | ✅ | ✅ |
| Case start: map with 4 rooms, the current room highlighted, markers "1. Đồng hồ trên sàn" … "4. Ghế bành"; place and its 4 points read out | ✅ | ✅ |
| Hover a point in the list → its marker lights up | ✅ | ✅ |
| Click marker 1 on the map → that point is examined, result box shown, marker marked examined and pulsing, result read with "Ghi vào sổ tay: …" | ✅ | ✅ |
| `R` repeats the reading; clicking a room on the map opens it and reads it; the map toggle hides/shows the map | ✅ | ✅ |
| Witness: profile and statements read; 🔊 on one statement reads only that one; hint dialog read | ✅ | ✅ |
| Horizontal overflow · console errors | 0 px · none | 0 px · none |

Map screenshots of every room were reviewed for all 3 cases (`det-maps.mjs`).

## Found while testing

| Found | Fix |
|-------|-----|
| One interview could add 3 toasts, and fast play stacked many | One toast per action listing all new clues. Never more than 3 on screen |
| On phones the chosen place/person could be scrolled out of the sideways strip | The active item is scrolled into view after each render |
| A sloppy rank test asserted the wrong band | Rewrote it as an exact table of score → rank for 0–7 hints |
| Map screenshots: markers covered the name of the room being inspected, and small rooms (the hall) were unreadable | The inspected room has no inner label (its name is above the map). Markers moved below the label zone, map widened |
| Map screenshots: the floor labels of case 3 and the caption of case 2 were cut off at the edge | Narrower rooms in case 3, labels moved inside the frame |
| A long word with no spaces was cut at 181 characters, not 180 (`speech.test.js`) | Off-by-one in the hard cut fixed |
| The browser harness hung: the DevTools socket opened before the script listened for it | Harness fix only (not a game bug) |
| Screenshots seemed to show toasts that never went away | A DOM check showed they are removed after 3.2 s. Headless screenshots were lagging, not the page |
