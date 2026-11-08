# 02 · Design (plan + analysis)

## Architecture

```text
index.html ─► src/main.js   UI controller: screens, tabs, dialogs, toasts, persistence
                 │                                         src/ui/
                 ▼                                           portrait.js  code-drawn SVG suspects
            src/core/investigation.js  one play-through      audio.js     WebAudio sfx + music loop
                 │        ▲                                  storage.js   safe localStorage
                 │        │ nextStep()
            src/core/solver.js   the assistant (hints) = the proof engine (tests)
            src/core/schema.js   validation + fair-play checks
            src/core/cases/      dong-ho.js · dai-bang.js · phong-khoa.js  (pure data)
```

`src/core/*` never touches the DOM. A case is **pure data**. The engine knows nothing about any
particular story, so a new case is a new data file plus zero code.

## Data model: everything is a clue

A single namespace of **clues** (`evidence`, `testimony`, `deduction`) carries all knowledge.
There are no hidden flags: the notebook *is* the game state the player can see.

```text
case
├─ clues[]        { id, kind, icon, name, text }
├─ locations[]    { id, name, icon, description, requires?, hotspots[] }
│    └─ hotspots  { id, name, text, requires?, gives? }
├─ suspects[]     { id, name, role, look, bio, requires?, statements[] }
│    └─ statement { id, text, requires?, gives?, contradiction?: { clue[], reply, gives? } }
├─ deductions[]   { id, from: [a, b], gives, text }
├─ accusation     { culprit, method{options, answer}, motive{options, answer}, evidence[] }
├─ support[]      clues that justify the solution (fair-play proof)
└─ intro[], epilogue[], source { original | adaptation + work, author, url }
```

`requires` opens the story gradually (the will in London appears only after Helen mentions her
mother's money). `gives` is the only way a clue enters the notebook.

## Rules (FR-3 – FR-11)

| Action | Cost | Effect |
|--------|------|--------|
| Examine a point | free | text, may give clues |
| Interview a suspect | free | hearing statements gives their testimony clues |
| Present a clue against a statement | wrong: −1 credibility | right: the reply is shown and new clues are given |
| Deduce (two clues) | wrong: mistake only | right: a deduction clue |
| Accuse (4 parts) | wrong: −2 credibility | tells *how many* parts were right, never which |
| Hint | rank only | points to the next useful action |

Credibility starts at 5, and 0 = case lost. **Score** = 100 − 12·wrong presents − 4·wrong
deductions − 20·wrong accusations − 6·hints. **Rank:** S ≥ 95, A ≥ 80, B ≥ 60, else C.
Deductions are cheap so experimenting is encouraged. Presenting is costly because it is a
public accusation of lying.

## The assistant is the proof

`solver.nextStep(inv)` works like a careful detective: examine anything that still yields a new
clue → interview anyone with unheard testimony → confront a statement you can disprove → combine
clues → accuse once every `support` clue is known. The same function powers:

- the **💡 hint** button (rephrased so it never names the clue to present), and
- the **tests:** `solve()` must finish each case with zero mistakes, `explore()` must reach every
  clue, point, statement, contradiction and deduction, and random play followed by the assistant
  must always finish (the player can never get stuck).

| Case | Clues | Scenes / points | Witnesses / statements | Deductions | Assistant steps |
|------|-------|-----------------|------------------------|------------|-----------------|
| Chiếc Đồng Hồ Ngừng Chạy | 20 | 4 / 10 | 4 / 14 | 4 | 18 |
| Dải Băng Lốm Đốm | 27 | 4 / 13 | 3 / 15 | 7 | 27 |
| Căn Phòng Khóa Trái | 24 | 4 / 13 | 4 / 13 | 5 | 22 |

## Case designs (spoilers)

- **Case 1:** the clock says 9:00. The dry floor + rain from 20:15 → the theft was before the rain;
  with the clock → **the time was staged**. Khải's 20:52 receipt only covers 20:45 onwards. The
  innocent liar Hùng was at karaoke from 19:32 and is cleared by his photos. Herbal sleeping
  powder + "Khải uses Phúc An" ties the drugged tea to him.
- **Case 2:** dummy bell-pull + ventilator → a **bridge** between the rooms. Plus the clamped
  bed → **a trap**. Milk + Indian animals → a hidden creature. Plus "speckled band" → **a snake**.
  The clang is the safe (the shutters are ruled out by confronting Helen). The will + engagement
  → **the motive in pounds**. Red herrings: the travellers, the cheetah and baboon, the shutters.
- **Case 3:** groove on the key + fishing line under the door → **locked from outside**. The mat
  sent for washing explains the gap. Line = Dr Lam's freshly cut reel. Wax on his slippers breaks
  his "never left my room". He carried the tea. The burnt chapter 7 names "L.". The innocent liar
  Đông lied about arriving and is cleared by a 22:41 fuel receipt.

## UI

- **Casebook** (case cards with difficulty, source, status, rank stamp) → **briefing** (a lined
  case file) → **investigation** with 4 tabs: Scenes, Witnesses, Notebook, Accuse. Endings reuse
  the briefing page (epilogue, rank stamp, stats).
- The result of the last action stays visible under the scene or the witness, and new clues are
  announced in one toast per action (aria-live, capped at 3).
- Confronting uses a native `<dialog>` (focus trap, Esc). The accusation is a real `<form>` with
  radio groups (keyboard and screen-reader friendly).
- Phones (≤ 760 px): bottom tab bar, horizontally scrolling place/person strip.
- Portraits are SVG built from `look` (hue, hair, glasses, hat, beard). There are no image files.
- Saves: `case:<id>` (investigation JSON plus heard statements) after every action;
  `progress` = best rank per solved case.

## Scene map (FR-15)

- Data: each location has `area: [x, y, w, h]` on a 100 × 64 plan, each hotspot has
  `at: [x, y]` as a percentage of its room, and `map.labels` adds street or floor names. The
  plan is optional in the schema, but when present `planErrors` (in `src/core/floorplan.js`)
  requires it to be complete: rooms inside the frame, no overlaps, a minimum room size, markers
  away from walls and at least 7 units apart so they never overlap on screen.
- The layout follows the story. In "The Speckled Band" Julia's room shares a wall with the
  doctor's: the ventilator is on that wall and the doctor's chair stands right under it on the
  other side. In the locked room, the key and the door gap are at the study door, next to the
  hall threshold where the fishing line is found. Tests check these facts.
- `src/ui/floorplan.js` returns HTML (no DOM, tested in Node). Rooms and markers are absolutely
  positioned buttons. The inspected room is highlighted and has no inner label (its name is shown
  above the map), so markers never cover text. Other rooms show small pins for their points.
  Hovering or focusing a point in the list lights up its marker, and the other way round. The
  last examined marker pulses.
- Desktop: the map sits beside the text (sticky). ≤ 1100 px: above the list. The map is
  `aria-hidden` and its buttons are out of the tab order, because it repeats the lists, which
  stay the accessible path.

## Read aloud (FR-16)

- `src/ui/speech.js` wraps the Web Speech API. No audio files and no online service: the
  browser's own voices are used. `pickVoice` prefers natural Vietnamese voices (Edge on Windows
  ships "Hoài My" and "Nam Minh"), then any `vi` voice. Without one, the browser's default is used
  and the player is told how to install one.
- `speakable` strips emoji, quote marks and symbols so the voice never reads them out.
  `sentences` joins parts with full stops so it pauses between them. `chunks` splits long text
  at sentence boundaries (≤ 180 characters) because some browsers stop long utterances.
- Off by default, because screen-reader users already hear the page. Each action reads its own
  result: a new action interrupts the previous reading. Toasts about new clues are not read
  because the result already lists them. Closing a dialog stops its reading.
- Music is lowered to 25 % while speaking (`duckMusic`).

## Risks

| Risk | Mitigation |
|------|------------|
| A case edit makes it unsolvable or leaves dead content | `validateCase` (structure + explore + solve) runs in CI for every case |
| Brute-forcing the accusation | Wrong accusation = −2 credibility, feedback is only "x/4 right" |
| Hints give the answer away | Hints name where to look, never which clue to present |
| Copyright | Adaptation only of a public-domain text, credited. Conan-style tricks only as ideas. A test forbids names from copyrighted series |
| Old save after a content change | Restore drops unknown clue ids. A broken save starts the case fresh |
| A map edit puts a marker in the wrong room or on top of another | `planErrors` in the validator, plus tests that every marker lies inside its own room only |
| No Vietnamese voice on the device | Falls back to the default voice with a notice; "How to play" explains how to add one |
| Read-aloud doubles a screen reader | Off by default; the screen-reader path (aria-live, labels) is unchanged |
