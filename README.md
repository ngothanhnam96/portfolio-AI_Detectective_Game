# Sổ Tay Thám Tử: Detective's Casebook

A browser **deduction game** in Vietnamese. Examine crime scenes, collect clues, catch lies by
presenting evidence against witness statements, combine clues into deductions, then name the
**culprit, method, motive and decisive evidence**.

- 3 cases: an original tutorial (staged-clock alibi), an adaptation of Conan Doyle's
  **"The Speckled Band"** (public domain), and an original locked-room mystery
- Confront, deduce and accuse, with credibility, an S/A/B/C rank and a hint assistant that never
  gives the answer away
- **Every case is provably fair:** an automated solver proves each case can be solved with zero
  mistakes, every clue is reachable, and the player can never get stuck
- **Scene map:** a floor plan of each case. The room being inspected is highlighted and every
  point of interest is a numbered marker at its real spot
- **Read aloud** for blind and low-vision players: a Vietnamese voice reads everything (browser
  speech, no audio files). Every sound also has a visual cue for deaf players
- Mouse, touch and keyboard · light and dark theme · progress saved on the device ·
  synthesised sound and music
- Zero dependencies, no build step, no asset files (portraits are code-drawn SVG)

## Play

```bash
npm start      # http://127.0.0.1:5173
```

| Key | Action |
|-----|--------|
| `1`–`4` | Scenes / Witnesses / Notebook / Accuse |
| `←` `→` on the tab bar | Move between tabs |
| `H` | Hint |
| `M` | Sound on/off |
| `V` | Read aloud on/off |
| `R` | Read the focused item, or repeat the last reading |
| `Esc` | Close a dialog · stop reading |

## Test

```bash
npm test       # 80 tests, ~0.3 s
```

## Project layout

```text
index.html, styles.css         UI shell
src/main.js                    screens, tabs, dialogs, toasts, persistence
src/ui/                        portrait.js (SVG suspects) · floorplan.js (scene map) · speech.js (read aloud)
                               audio.js · storage.js · analytics.js
src/core/                      pure rules and data (no DOM), fully unit-tested
  investigation.js             examine, interview, present, deduce, accuse, score, save
  solver.js                    the assistant: next step, solve, explore (hints + proofs)
  schema.js                    validation and fair-play rules
  floorplan.js                 plan geometry and its validation
  cases/                       one data file per case
tests/                         node:test suites + a mini case
scripts/serve.mjs              zero-dependency static dev server
```

**Adding a case** = writing one data file in `src/core/cases/` and listing it in `index.js`.
The tests validate it and prove it fair automatically.

## Engineering process

0. [Research](docs/00-RESEARCH.md): sources, copyright status, fair-play rules
1. [Spec](docs/01-SPEC.md): requirements
2. [Design](docs/02-DESIGN.md): data model, rules, solver, UI, risks
3. [Tasks](docs/03-TASKS.md): traceable task list and backlog
4. Implementation: `src/`
5. [Testing](docs/04-TESTING.md): unit suites, solver proofs, browser e2e
6. [Deploy](docs/05-DEPLOY.md): GitHub Pages, CI

## Credits and license

- Case 2 is adapted from **"The Adventure of the Speckled Band"** by **Arthur Conan Doyle** (1892),
  public domain. Source text: [Project Gutenberg eBook #1661](https://www.gutenberg.org/ebooks/1661).
- Cases 1 and 3, all other text, the portraits, the sounds and the music are original. Genre
  tricks (staged time, receipt alibis, thread-locked rooms) are common ideas of the detective genre.
  No characters or stories from copyrighted series are used.
- Code licensed under MIT.

## Analytics

Optional, anonymous play counts via [GoatCounter](https://www.goatcounter.com): no cookies and no
personal data. It is off until you set `GOATCOUNTER_CODE` in `src/ui/analytics.js`. Events are
sent when a game starts and when it ends; see the `track(...)` calls in `src/main.js`.
