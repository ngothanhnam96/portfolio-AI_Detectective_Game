# 01 · Specification: *Sổ Tay Thám Tử* (Detective's Casebook)

A browser **deduction game** in Vietnamese. The player is a detective who examines crime
scenes, collects clues, catches lies in witness statements, combines clues into deductions and
finally names the culprit, the method, the motive and the decisive evidence. See
[00-RESEARCH](00-RESEARCH.md) for the sources and the fair-play rules.

## Core loop

Choose a case → read the briefing → **investigate** (scenes, witnesses, notebook) → **accuse**
→ epilogue and rank. A wrong move costs credibility. If credibility runs out, the case is lost
and can be restarted.

## Functional requirements

| ID    | Requirement |
|-------|-------------|
| FR-1  | **Case select:** three cases with difficulty, setting, source (original or adaptation) and best rank. Later cases unlock when the previous one is solved. |
| FR-2  | **Briefing:** a short narrated introduction before each case. |
| FR-3  | **Scenes:** each case has 3–5 locations with points of interest. Examining a point shows text and may add clues to the notebook. Some points and locations appear only after a clue is known. |
| FR-4  | **Witnesses:** each suspect has a profile and statements. New statements may appear after a clue is known. |
| FR-5  | **Confront:** the player can present a clue against a statement. The right clue exposes a contradiction: the witness reacts and new clues appear. The wrong clue costs 1 credibility. |
| FR-6  | **Notebook:** every clue (evidence, testimony, deduction) with its description, plus a log of everything read. |
| FR-7  | **Deduce:** combining the right two clues produces a deduction, a new clue. A wrong pair costs no credibility but counts as a mistake. |
| FR-8  | **Accuse:** pick culprit, method, motive and decisive evidence. If any part is wrong, the player learns how many of the 4 parts were right, and loses 2 credibility. All 4 right → solved. |
| FR-9  | **Credibility** starts at 5. At 0 the case is lost and can be restarted. |
| FR-10 | **Hints:** the assistant points to the next useful action (where to look, whom to question, which clue to combine) without giving the answer. Hints lower the rank. |
| FR-11 | **Rank** S/A/B/C from mistakes and hints, shown in the epilogue and on the case card. |
| FR-12 | **Persistence:** an unfinished case resumes where it was left; solved cases and best ranks are saved on the device. |
| FR-13 | Sound effects and quiet background music, each with an on/off switch. |
| FR-14 | Mouse, touch and keyboard (all actions are buttons; tab order is logical). |
| FR-15 | **Scene map:** while inspecting a scene, a floor plan of the case shows every place as a room. The room being inspected is highlighted, and each point of interest is a numbered marker at its real position, numbered like its button in the list. Clicking a room opens it; clicking a marker examines that point. Places not yet open show as "?". The map can be hidden. |
| FR-16 | **Read aloud:** an on/off switch (home screen, top bar, key `V`) reads the briefing, the place and its points, every examination result, witness profiles and statements, confrontation results, hints, dialogs and endings in a Vietnamese voice. A 🔊 button reads one block on demand, `R` reads the focused item or repeats, `Esc` stops, and the reading speed is adjustable. Music is lowered while reading. |

## Content requirements

| ID   | Requirement |
|------|-------------|
| CR-1 | Case 1 (tutorial, original): a staged-clock alibi trick. |
| CR-2 | Case 2: an adaptation of Conan Doyle's "The Speckled Band" (public domain), credited in the game and README. |
| CR-3 | Case 3 (original): a locked-room case with an innocent liar. |
| CR-4 | No characters, names or plots from copyrighted works. |

## Non-functional requirements

| ID    | Requirement |
|-------|-------------|
| NFR-1 | Static site: no build step, no runtime dependencies, no asset files (portraits are code-drawn SVG). |
| NFR-2 | Game rules and case data live in pure ES modules with no DOM access, unit-tested in Node. |
| NFR-3 | **Every case is provably fair:** an automated solver proves the case can be solved from the start with zero mistakes, every clue can be reached, and the solution's support is reachable (see the fair-play rules). |
| NFR-4 | Case data is validated: unique ids, every reference resolves, exactly one answer per question. |
| NFR-5 | Responsive from 360 px phones to desktop with no horizontal overflow. Light and dark theme. |
| NFR-6 | Accessible: semantic buttons, visible focus, status not shown by colour alone, `aria-live` for new clues. **Blind and low-vision players:** everything can be read aloud (FR-16), and the map only repeats what the lists already say. **Deaf and hard-of-hearing players:** no information is given by sound alone; every sound has a text or visual equivalent (toast, flash, shaking credibility, result box). |
| NFR-7 | CI runs the tests on every push. GitHub Pages deploys from `main`. |

## Out of scope (v1)

Recorded voice acting (read-aloud uses the browser's speech synthesis), branching endings, a case editor UI, online leaderboards.
