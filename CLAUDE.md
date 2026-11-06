# CLAUDE.md: how to work in this repo

This file is read by the AI assistant (Claude) before every task. Keep it short, concrete and testable.

## Stack

- **App:** Vite 8 · React 19 · TypeScript (strict). One Vite app, one page per assignment: `settings/`, `buttons/`,
  `viewer/` and `hero/`, each with its own `src/<page>/`.
- **3D:** three + @react-three/fiber + @react-three/drei.
- **Shaders:** plain WebGL2 and GLSL ES 3.0. No shader library.
- **Tests:** Vitest + Testing Library (jsdom). Run them with `npm test`.
- **Deploy:** GitHub Pages through `.github/workflows/deploy.yml`, with `BASE_PATH=/flyrank-frontend-ai/`.

## Conventions

- **Commits** follow Conventional Commits 1.0.0, e.g. `feat(buttons): …`, `fix(viewer): …`, `docs: …`, `test: …`,
  `chore: …`. The scope is the page name.
- **Styles** are plain CSS files next to the component. Colours come only from the tokens in `src/shared/base.css`:
  no hex values in component CSS, except inside shaders.
- **Links and assets** are built with `import.meta.env.BASE_URL`, never a leading `/`, so the GitHub Pages sub-path
  works.
- **Motion** animates only `transform` and `opacity`. Every animation has a `prefers-reduced-motion` branch that keeps
  the feedback (colour, text) and drops the movement.
- **Every interactive element:**
  - is reachable by keyboard
  - has a visible `:focus-visible` style
  - has an accessible name
- **A feature is done** when it has a test, or for visual-only work, a written note on how it was checked. `npm test`
  and `npm run build` must both pass before a commit.

## Workflow (explore → plan → code → verify)

1. Read the files you will touch, and this file.
2. Write a short plan. List the files, and what "done" means.
3. Implement.
4. Run `npm test` and `npm run build`, and fix what fails.
5. Say what you verified, and what you did not verify.
