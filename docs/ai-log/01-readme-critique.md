# FE-01: the AI critique of the README

**Prompt** (to a fresh Claude session, read-only):

> Read README.md and CLAUDE.md. Act as a strict reviewer of the README for a recruiter or mentor who lands on the repo
> cold. Don't edit files. Reply with the 5 most important weaknesses, ranked, and the exact markdown for fixing #1.

## What it said

The ranked weaknesses, in its words:

1. The live site is never linked, and the table shows folder names instead of clickable demos.
2. There is no screenshot or GIF, so the visual work is invisible from the repo page.
3. Assignment codes like "FE-AA1" mean nothing to outsiders, and there's no line on what each page shows.
4. The real strengths (strict TS, tests, accessibility, reduced motion, CI deploy) are hidden in CLAUDE.md.
5. It says "built with Claude", but not what *I* decided or checked. There's also no author line.

It also caught that package.json doesn't list three / @react-three/fiber yet, although CLAUDE.md says the stack uses
them. That's true at this point: the viewer isn't built yet. It's a fair flag, and I'll check it when the viewer lands.

## What I applied

**#1:** the live-demo link, plus a table with clickable demos and a "What it shows" column. The AI said its "What it
shows" lines were guesses, so I rewrote them to match what each page actually does.

**Deferred:** #2 (screenshots) and #4/#5 (strengths, authorship) go into the final README, once the pages exist.
