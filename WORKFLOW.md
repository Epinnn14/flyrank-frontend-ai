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

Round 1 built *a* settings form: a generic profile with name, email, website, bio and time zone.

- It is a plausible guess, but it isn't the settings an AI chat app needs: no model, no temperature, no response
  length, no system prompt.
- Nothing persists. `fakeSave` waits 600 ms, and a reload loses everything.
- There is no reset, and no "unchanged" state.

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

The second click worked. I found it with Playwright, measuring the button's bounding box before and after. jsdom
can't catch it, because it has no layout.

Round 2 avoids it by validating long text as you type. On submit it shows an error summary at the top and focuses it.
I ran the same browser check on round 2, and the submit fired on the first click.

## Accessibility

| | Round 1 | Round 2 |
|---|---|---|
| Field errors | `aria-invalid`, `aria-describedby` | `aria-invalid`, `aria-describedby` |
| Labels | yes | yes |
| Focus on submit | first invalid field (only when the click lands) | error summary (`role="alert"`, links to each field) |
| Radio groups | none | `fieldset`/`legend` |
| Save while busy | not handled | `aria-disabled` keeps the button focusable |
| Duplicate messages | bio shows a counter AND an error | one message per field |

## Edge cases round 1 never considered

Storage failures, invalid saved data, and `http://localhost:3000` (rejected: its check wants a dot in the hostname).

## Review effort and total time

Round 1 was 4× faster to generate, but reviewing it meant finding a hidden bug and listing five spec gaps. Each gap
would need another prompt and another review.

Round 2 took longer: the prompt took real thought to write, and generation took 4× longer. My review was a read-through plus three
browser checks: desktop, 360 px and dark mode. I found nothing to fix.

The cost: 1,694 lines and 80 tests to review for one form.

**Round 2 felt slower, but it was faster end-to-end:** one pass instead of a fix-and-re-prompt loop.

## What I'd change next time

Round 1 read the rules file already in the repo (it used tokens, labels and a test file), so it was better than a truly
context-free round. The real gap was **requirements**, not code quality. [CLAUDE.md](CLAUDE.md) now encodes that
(see "Rules learned from the FE-04 drill").
