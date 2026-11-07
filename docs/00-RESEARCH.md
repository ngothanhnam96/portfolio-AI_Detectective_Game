# 00 · Research: detective-story sources

Before the spec, I read the genre's sources to learn how a fair, solvable mystery is built,
and to decide which material may be used directly and which may only inspire.

## Sources

| Source | Status | How it is used |
|--------|--------|----------------|
| Arthur Conan Doyle, *The Adventures of Sherlock Holmes* (1892). Project Gutenberg eBook #1661, <https://www.gutenberg.org/ebooks/1661> | **Public domain.** Doyle died in 1930, so it is free in life+50/70 countries, and every Holmes story is public domain in the US since 2023 | Case 2, *Dải Băng Lốm Đốm*, is an interactive adaptation of "The Adventure of the Speckled Band", rewritten in Vietnamese and credited in the game |
| Gosho Aoyama, *Detective Conan* (1994–) | **Copyrighted** | Only general genre tricks are used (fake time of death, receipt alibi, thread-and-key locked room). No characters, names, plots or art |
| Ronald Knox, "Decalogue" (1929) and S. S. Van Dine, "Twenty Rules for Writing Detective Stories" (1928) | Ideas, paraphrased | Turned into **fair-play rules that the tests enforce** (below) |

Ideas and tricks are not protected, only their expression. Every case text in this game is
newly written, and the adaptation follows a public-domain original.

## What the Speckled Band teaches (verified against the Gutenberg text)

The case works because every piece of the solution is placed in front of the reader:

- A **bell-pull that rings nothing**, a **ventilator into the next room** rather than to the outside,
  and a **bed clamped to the floor** together describe a path for something to climb down.
- A **saucer of milk** with no cat, a **locked iron safe**, a **dog lash tied in a loop**, and a
  **low whistle and a metallic clang** in the night point to an animal trained to come back.
- **Motive in numbers:** the family income has fallen to £750 a year, and each daughter may claim
  £250 when she marries. Two marriages would ruin the stepfather.
- **Red herrings:** the wandering travellers ("a band of people"), the cheetah and the baboon, and
  the window shutters. The clang is the safe door, not a shutter bar.

The game keeps that structure. Clues alone suggest things, but **combining two clues** proves
something (bell-pull + ventilator → a bridge between the rooms), and the accusation asks for
culprit, method, motive and the decisive evidence separately.

## Genre tricks used in the original cases

| Trick (genre-wide) | Used in |
|--------------------|---------|
| Broken clock that "freezes" a false time of the crime, giving the culprit an alibi | Case 1 |
| Alibi from a receipt or photo that covers the wrong time window | Case 1 |
| Room locked from inside: the key is turned from outside with a fishing line pulled under the door | Case 3 |
| A suspect who lies to hide something embarrassing, not the crime (an innocent liar) | Cases 1 and 3 |

## Fair-play rules → tests

| Rule (paraphrased from Knox / Van Dine) | Enforced by |
|-----------------------------------------|-------------|
| The culprit must appear early in the story | The culprit is a suspect who is available from the start |
| Every clue the detective uses must be shown to the reader | Every solution `support` clue and every accepted evidence item can be reached by the solver |
| No supernatural or unknown means | Methods are physical and written as accusation options |
| One solution only | Exactly one answer per question. Every other combination is rejected |
| The detective must not get stuck | A step-by-step search proves the case can be solved from the start with zero mistakes |
