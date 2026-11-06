# WORKFLOW: the AI-assisted workflow drill (FE-04)

## The setup

The same feature, a settings form with validation, was built twice. Each round ran in a **fresh AI session** in its
own git worktree, so no context carried over. The exact prompts are in
[docs/ai-log/04-drill-prompts.md](docs/ai-log/04-drill-prompts.md).

| | Round 1: `drill/round-1-vague` | Round 2: `drill/round-2-precise` |
|---|---|---|
| Prompt | "make a settings form with validation" | Explore → plan → code → verify, with file paths, 6 exact rules, 6 behaviours, constraints and required tests |
| AI time | 86 s | 375 s |
| Code | 439 lines (`SettingsForm.tsx`, `validate.ts`) | 1,694 lines (`AssistantSettings.tsx`, `validate.ts`) |
| Tests | 9 | 80, plus 6 deliberate mutations that it checked the tests catch |

## Correctness

Round 1 built *a* settings form: a generic profile (name, email, website, bio, time zone). It's a plausible guess, but
it has none of the settings an AI chat app needs, nothing persists (`fakeSave` waits 600 ms), and there's no reset. It
also never considered storage failures or corrupt saved data, and it rejects `http://localhost:3000`.

Round 2 implements every rule in the spec. In both the tests and the browser:

- "abc" and "1.5" for temperature are errors, and the slider doesn't move.
- "100.5" tokens is an error.
- A 5,000-character paste shows "3000 characters too many" and is not truncated.
- The digest-day field appears and disappears, and its error is cleared with it.
- Corrupt `localStorage` JSON falls back to the defaults.

## The AI mistake I caught

Round 1 passed all 9 of its tests, but **in a real browser the first click on "Save settings" did nothing**. Here's
the sequence when the bio is too long:

1. Mousedown on Save blurs the textarea.
2. The blur handler inserts the bio error.
3. The error pushes the Save button down 26 px (777 → 803).
4. Mouseup lands on empty space, so no submit happens.

I found it with Playwright by measuring the button's position. jsdom can't catch it: it has no layout.

**Round 2 had the same bug, and I almost missed it.** My first check (display name) passed. The README screenshot
run then typed "abc" into temperature and clicked Save once: no summary, and focus stayed on the button. Validating on
blur is the cause in both rounds.

The fix is on `main` in `fix(settings)`: skip blur validation when focus moves to Save or Reset (submit validates
everything anyway), with a regression test. I re-checked it in the browser on temperature, tokens and name. The
`drill/round-2-precise` branch is left exactly as generated.

## Accessibility

| | Round 1 | Round 2 |
|---|---|---|
| Field errors | `aria-invalid`, `aria-describedby` | `aria-invalid`, `aria-describedby` |
| Labels | yes | yes |
| Focus on submit | first invalid field (only when the click lands) | error summary (`role="alert"`, links to each field) |
| Radio groups | none | `fieldset`/`legend` |
| Save while busy | not handled | `aria-disabled` keeps the button focusable |
| Duplicate messages | bio shows a counter AND an error | one message per field |

## Review effort and total time

Round 1 was 4× faster to generate, but its review found a hidden bug plus five spec gaps, each needing another prompt
and another review. Round 2's prompt took real thought, and generation took 4× longer; its review found one bug. The
cost: 1,694 lines and 80 tests to review for one form.

**Round 2 felt slower, but it was faster end-to-end:** one pass instead of a fix-and-re-prompt loop.

## What I'd change next time

Round 1 read the rules file already in the repo (it used tokens, labels and a test file), so it was better than a truly
context-free round. The real gap was **requirements**, not code quality. [CLAUDE.md](CLAUDE.md) now encodes that
(see "Rules learned from the FE-04 drill").
