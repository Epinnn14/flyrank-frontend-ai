import { act, fireEvent, render, screen } from "@testing-library/react";
import { AsyncButton } from "./AsyncButton";
import { HOLD, fakeRequest } from "./useAsyncAction";

const labels = { idle: "Send", loading: "Sending", success: "Sent", error: "Retry" };

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const button = () => screen.getByRole("button");
const state = () => button().getAttribute("data-state");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("goes idle → loading → success → idle, announcing each step", async () => {
  const d = deferred();
  render(<AsyncButton labels={labels} action={() => d.promise} />);
  expect(state()).toBe("idle");
  expect(button()).toHaveAccessibleName("Send");

  fireEvent.click(button());
  expect(state()).toBe("loading");
  expect(button()).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Sending");

  await act(async () => d.resolve());
  expect(state()).toBe("success");
  expect(button()).toHaveAccessibleName("Sent");
  expect(screen.getByRole("status")).toHaveTextContent("Sent");

  act(() => vi.advanceTimersByTime(HOLD.success));
  expect(state()).toBe("idle");
});

it("ignores spam clicks while sending and while showing success (no double send)", async () => {
  const d = deferred();
  const action = vi.fn(() => d.promise);
  render(<AsyncButton labels={labels} action={action} />);
  for (let i = 0; i < 5; i++) fireEvent.click(button());
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => d.resolve());
  fireEvent.click(button());
  fireEvent.click(button());
  expect(action).toHaveBeenCalledTimes(1);
});

it("on failure shows Retry, and a click retries immediately", async () => {
  const first = deferred();
  const second = deferred();
  const action = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<AsyncButton labels={labels} action={action} announcements={{ error: "Couldn't send. Press Retry." }} />);
  fireEvent.click(button());
  await act(async () => first.reject(new Error("boom")));
  expect(state()).toBe("error");
  expect(button()).toHaveAccessibleName("Retry");
  expect(screen.getByRole("status")).toHaveTextContent("Couldn't send. Press Retry.");

  fireEvent.click(button());
  expect(action).toHaveBeenCalledTimes(2);
  expect(state()).toBe("loading");
  await act(async () => second.resolve());
  expect(state()).toBe("success");
});

it("an unanswered error returns to idle on its own", async () => {
  render(<AsyncButton labels={labels} action={() => Promise.reject(new Error("x"))} />);
  fireEvent.click(button());
  await act(async () => {});
  expect(state()).toBe("error");
  act(() => vi.advanceTimersByTime(HOLD.error));
  expect(state()).toBe("idle");
});

it("a stale success timer can't reset a newer run", async () => {
  const first = deferred();
  const second = deferred();
  const action = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<AsyncButton labels={labels} action={action} />);
  fireEvent.click(button());
  await act(async () => first.reject(new Error("x")));      // error, its idle timer is pending
  fireEvent.click(button());                                 // retry → loading
  act(() => vi.advanceTimersByTime(HOLD.error));             // the old timer fires
  expect(state()).toBe("loading");
});

it("disabled stays focusable, explains why, and does nothing on click", () => {
  const action = vi.fn(() => Promise.resolve());
  render(<AsyncButton labels={labels} action={action} disabledReason="Type a message first" />);
  button().focus();
  expect(button()).toHaveFocus();
  expect(button()).toHaveAttribute("aria-disabled", "true");
  expect(button()).toHaveAccessibleDescription("Type a message first");
  fireEvent.click(button());
  expect(action).not.toHaveBeenCalled();
});

it("is a real button: Enter and Space work through the native element", () => {
  render(<AsyncButton labels={labels} action={() => new Promise(() => {})} />);
  expect(button().tagName).toBe("BUTTON");
  expect(button()).toHaveAttribute("type", "button");
});

it("fakeRequest fails at the given rate and waits between min and max", async () => {
  const ok = fakeRequest(0.2, 100, 200, () => 0.5);         // 0.5 ≥ 0.2 → success, delay 150 ms
  const bad = fakeRequest(0.2, 100, 200, () => 0.1);        // 0.1 < 0.2 → failure
  const okSpy = vi.fn();
  const badSpy = vi.fn();
  ok.then(okSpy);
  bad.catch(badSpy);
  await act(async () => vi.advanceTimersByTime(149));
  expect(okSpy).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(60));
  expect(okSpy).toHaveBeenCalled();
  expect(badSpy).toHaveBeenCalled();
});
