import { useCallback, useEffect, useRef, useState } from "react";

export type ButtonState = "idle" | "loading" | "success" | "error";

/** How long each resting state is shown before going back to idle (ms). */
export const HOLD = { success: 1400, error: 2600 } as const;

/**
 * The button's lifecycle as a tiny state machine:
 *
 *   idle ──click──▶ loading ──resolve──▶ success ──1.4 s──▶ idle
 *                      │
 *                      └──reject──▶ error ──click (retry)──▶ loading
 *                                     └──2.6 s──▶ idle
 *
 * Interruptible by construction: clicks during `loading` or `success` are ignored (no double send), a click during
 * `error` retries immediately, and a late result from an older run can't overwrite a newer one (run ids).
 */
export function useAsyncAction(action: () => Promise<void>, disabled = false) {
  const [state, setState] = useState<ButtonState>("idle");
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const trigger = useCallback(async () => {
    if (disabled || state === "loading" || state === "success") return;
    clearTimeout(timer.current);
    const id = ++run.current;
    setState("loading");
    let next: ButtonState;
    try {
      await action();
      next = "success";
    } catch {
      next = "error";
    }
    if (id !== run.current) return;                       // a newer run owns the button now
    setState(next);
    timer.current = setTimeout(() => {
      if (id === run.current) setState("idle");
    }, HOLD[next as "success" | "error"]);
  }, [action, disabled, state]);

  return { state, trigger };
}

/** A fake network call: random delay, and a failure rate (0.2 = 20 %). */
export function fakeRequest(failureRate: number, minMs = 700, maxMs = 1600, random = Math.random): Promise<void> {
  const delay = minMs + random() * (maxMs - minMs);
  const fails = random() < failureRate;
  return new Promise((resolve, reject) =>
    setTimeout(() => (fails ? reject(new Error("request failed")) : resolve()), delay),
  );
}
