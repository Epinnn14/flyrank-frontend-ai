# FE-04: the exact prompts

Each round ran in a fresh AI session (Claude) inside its own git worktree, created from the same `main` commit.

## Round 1 (`drill/round-1-vague`)

The whole prompt:

> In /home/claude/fe/round1, make a settings form with validation.

The output was committed as-is. Generation took 86 s, and the result had 9 tests.

## Round 2 (`drill/round-2-precise`)

> Work ONLY inside /home/claude/fe/round2 (a git worktree of a Vite 8 + React 19 + TypeScript app; dependencies are
> installed). Do not commit.
>
> Task: build the settings page for an AI chat assistant at `settings/` → `src/settings/`.
>
> Explore first: read CLAUDE.md, src/shared/base.css, vite.config.ts, src/settings/main.tsx and src/home/Home.tsx.
> Then write a short plan (files + what "done" means) in your reply BEFORE coding, then implement, then verify.
>
> Files to create: `src/settings/validate.ts` (pure functions, no React), `src/settings/AssistantSettings.tsx`,
> `src/settings/AssistantSettings.css`, `src/settings/validate.test.ts`, `src/settings/AssistantSettings.test.tsx`;
> update `src/settings/main.tsx` to render the page under the existing back link.
>
> Fields and rules (exact):
> 1. Display name: required; trimmed; 2–40 characters after trim; whitespace-only is "required".
> 2. Model: radio group `fast` | `balanced` | `smart` (default `balanced`).
> 3. Temperature: 0–1 in steps of 0.1. Show a range slider AND a number input that stay in sync. Typing "abc" or
>    "1.5" shows an error and does not move the slider.
> 4. Max response length (tokens): integer 64–4096; "100.5" is an error.
> 5. System prompt: optional textarea, max 2000 characters, live "N characters left" counter; pasting 5000
>    characters must show the over-limit error, not truncate silently.
> 6. Weekly digest: checkbox; when checked, a "Digest day" select (Mon–Sun) appears and is required. When unchecked,
>    the day field is removed and any error on it is cleared.
>
> Behavior:
> - Validate a field on blur; after a field has been blurred once, re-validate it on change.
> - On submit with errors: show an error summary box at the top (role="alert", heading "There is a problem", a list of
>   links to each invalid field's id), move focus to the summary, and mark fields aria-invalid with aria-describedby
>   pointing at their error text.
> - On valid submit: save to localStorage key `assistant-settings:v1` (wrap reads/writes in try/catch; if storage
>   throws, show "Couldn't save on this device" instead of crashing), show "Settings saved" in a role="status" region,
>   prevent double submit while saving (simulate 400 ms async).
> - Load saved values on mount (ignore invalid/corrupt JSON and fall back to defaults).
> - "Reset" button restores the last saved values (or defaults) and clears errors.
> - Save button is disabled (aria-disabled + prevented) until the form differs from the last saved values.
>
> Constraints: no new dependencies. Plain CSS using only tokens from src/shared/base.css (no hex colors). Labels on
> every control; radio group uses fieldset/legend. Animations (if any) only transform/opacity with a
> prefers-reduced-motion branch. Works at 360px width.
>
> Verification (required): write tests for every numbered rule and every Behavior bullet above (unit tests for
> validate.ts, Testing Library tests for the component, including the 5000-char paste, the "abc" temperature, the
> digest day appearing/disappearing, the summary focus, localStorage throwing, and corrupt saved JSON). Then run
> `npm test` and `npm run build` and fix until both pass. In your final reply: the plan, the files, test count, and
> anything you did NOT verify.

Generation took 375 s, and the result had 80 tests. The AI also mutation-checked its own tests: it broke the component
6 ways, found that 2 of the breakages were not caught, and added tests for them.

## My browser check (Playwright, Chromium)

| Round | Check | Result |
|---|---|---|
| 1 | Fill a 2,100-character bio, then click Save once | The Save button moved from y=777 to y=803 during the click. Nothing was submitted; only `bio` was marked invalid. The second click submitted |
| 2 | Display name `"   "`, then click Save once | Submitted on the first click. The error summary was shown and focused (`DIV.error-summary`, `tabindex=-1`), and `display-name` was marked `aria-invalid` |
| 2 | Layout at 360 px | No horizontal scroll (`scrollWidth` 360) |
| 2 | Dark mode | Checked by screenshot |
