import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantSettings } from "./AssistantSettings";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "./validate";

function setup(props: { saveDelayMs?: number } = {}) {
  const user = userEvent.setup();
  render(<AssistantSettings {...props} />);
  return {
    user,
    name: () => screen.getByLabelText("Display name") as HTMLInputElement,
    temp: () => screen.getByLabelText("Temperature") as HTMLInputElement,
    slider: () => screen.getByLabelText("Temperature slider") as HTMLInputElement,
    tokens: () => screen.getByLabelText("Max response length (tokens)") as HTMLInputElement,
    prompt: () => screen.getByLabelText(/System prompt/) as HTMLTextAreaElement,
    digest: () => screen.getByLabelText("Send me a weekly digest") as HTMLInputElement,
    save: () => screen.getByRole("button", { name: /^Save|Saving/ }),
    reset: () => screen.getByRole("button", { name: "Reset" }),
  };
}

function errorFor(el: HTMLElement): HTMLElement | null {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(" ").filter((id) => id.endsWith("-error"));
  return ids.length ? document.getElementById(ids[0]) : null;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rendering", () => {
  it("labels every control and uses a fieldset/legend for the model radios", () => {
    const f = setup();
    expect(f.name()).toHaveValue("Assistant");
    expect(f.temp()).toHaveValue("0.7");
    expect(f.slider()).toHaveValue("0.7");
    expect(f.tokens()).toHaveValue("1024");
    expect(f.prompt()).toHaveValue("");
    expect(f.digest()).not.toBeChecked();
    const group = screen.getByRole("group", { name: "Model" });
    expect(group.tagName).toBe("FIELDSET");
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
  });
});

describe("rule 1: display name, validated on blur then on change", () => {
  it("shows nothing while typing before the first blur", async () => {
    const f = setup();
    await f.user.clear(f.name());
    expect(screen.queryByText("Enter a display name")).not.toBeInTheDocument();
    expect(f.name()).not.toHaveAttribute("aria-invalid");
  });

  it("shows 'required' for whitespace-only on blur", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.type(f.name(), "   ");
    await f.user.tab();
    expect(f.name()).toHaveAttribute("aria-invalid", "true");
    expect(errorFor(f.name())).toHaveTextContent("Enter a display name");
  });

  it("re-validates on change after the field has been blurred once", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.tab();
    expect(errorFor(f.name())).toHaveTextContent("Enter a display name");
    await f.user.type(f.name(), "A");
    expect(errorFor(f.name())).toHaveTextContent("at least 2 characters");
    await f.user.type(f.name(), "d");
    expect(errorFor(f.name())).toBeNull();
    expect(f.name()).not.toHaveAttribute("aria-invalid");
  });

  it("rejects more than 40 characters", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.type(f.name(), "x".repeat(41));
    await f.user.tab();
    expect(errorFor(f.name())).toHaveTextContent("40 characters or fewer");
  });

  it("saves the trimmed name", async () => {
    const f = setup({ saveDelayMs: 0 });
    await f.user.clear(f.name());
    await f.user.type(f.name(), "  Ada  ");
    await f.user.click(f.save());
    await screen.findByText("Settings saved");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).displayName).toBe("Ada");
    expect(f.name()).toHaveValue("Ada");
  });
});

describe("rule 2: model radio group", () => {
  it("defaults to balanced and can be changed", async () => {
    const f = setup({ saveDelayMs: 0 });
    expect(screen.getByRole("radio", { name: /Balanced/ })).toBeChecked();
    await f.user.click(screen.getByRole("radio", { name: /Smart/ }));
    expect(screen.getByRole("radio", { name: /Smart/ })).toBeChecked();
    await f.user.click(f.save());
    await screen.findByText("Settings saved");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).model).toBe("smart");
  });
});

describe("rule 3: temperature slider and number input stay in sync", () => {
  it("moves the number input when the slider moves", () => {
    const f = setup();
    fireEvent.change(f.slider(), { target: { value: "0.9" } });
    expect(f.temp()).toHaveValue("0.9");
  });

  it("moves the slider when a valid number is typed", async () => {
    const f = setup();
    await f.user.clear(f.temp());
    await f.user.type(f.temp(), "0.3");
    expect(f.slider()).toHaveValue("0.3");
  });

  it("typing 'abc' shows an error and does not move the slider", async () => {
    const f = setup();
    await f.user.clear(f.temp());
    await f.user.type(f.temp(), "abc");
    await f.user.tab();
    expect(f.temp()).toHaveAttribute("aria-invalid", "true");
    expect(errorFor(f.temp())).toHaveTextContent("Temperature must be a number");
    expect(f.slider()).toHaveValue("0.7");
  });

  it("typing '1.5' shows an error and does not move the slider", async () => {
    const f = setup();
    await f.user.clear(f.temp());
    await f.user.type(f.temp(), "1.5");
    await f.user.tab();
    expect(errorFor(f.temp())).toHaveTextContent("between 0 and 1");
    // "1" was valid on the way to "1.5", so the slider sits at 1, never beyond the range.
    expect(Number(f.slider().value)).toBeLessThanOrEqual(1);
    await f.user.clear(f.temp());
    await f.user.type(f.temp(), "0.2");
    expect(f.slider()).toHaveValue("0.2");
    await f.user.type(f.temp(), "5");
    expect(errorFor(f.temp())).toHaveTextContent("steps of 0.1");
    expect(f.slider()).toHaveValue("0.2");
  });

  it("moving the slider clears a temperature error", async () => {
    const f = setup();
    await f.user.clear(f.temp());
    await f.user.type(f.temp(), "abc");
    await f.user.tab();
    fireEvent.change(f.slider(), { target: { value: "0.4" } });
    expect(f.temp()).toHaveValue("0.4");
    expect(errorFor(f.temp())).toBeNull();
  });
});

describe("rule 4: max response length", () => {
  it("'100.5' is an error", async () => {
    const f = setup();
    await f.user.clear(f.tokens());
    await f.user.type(f.tokens(), "100.5");
    await f.user.tab();
    expect(errorFor(f.tokens())).toHaveTextContent("Max response length must be a whole number");
  });

  it("values outside 64–4096 are errors", async () => {
    const f = setup();
    await f.user.clear(f.tokens());
    await f.user.type(f.tokens(), "10");
    await f.user.tab();
    expect(errorFor(f.tokens())).toHaveTextContent("between 64 and 4096");
  });
});

describe("rule 5: system prompt", () => {
  it("shows a live 'N characters left' counter", async () => {
    const f = setup();
    expect(screen.getByText("2000 characters left")).toBeInTheDocument();
    await f.user.type(f.prompt(), "hello");
    expect(screen.getByText("1995 characters left")).toBeInTheDocument();
    expect(f.prompt()).toHaveAccessibleDescription(expect.stringContaining("1995 characters left"));
  });

  it("pasting 5000 characters shows the over-limit error and does not truncate", async () => {
    const f = setup();
    await f.user.click(f.prompt());
    await f.user.paste("a".repeat(5000));
    expect(f.prompt().value).toHaveLength(5000);
    expect(f.prompt()).toHaveAttribute("aria-invalid", "true");
    expect(errorFor(f.prompt())).toHaveTextContent("System prompt must be 2000 characters or fewer (3000 over)");
    expect(screen.getByText("3000 characters too many")).toBeInTheDocument();
  });
});

describe("rule 6: weekly digest", () => {
  it("shows the Digest day select only while the checkbox is checked", async () => {
    const f = setup();
    expect(screen.queryByLabelText("Digest day")).not.toBeInTheDocument();
    await f.user.click(f.digest());
    const select = screen.getByLabelText("Digest day");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a day",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    await f.user.click(f.digest());
    expect(screen.queryByLabelText("Digest day")).not.toBeInTheDocument();
  });

  it("requires a day, and unchecking removes the field and clears its error", async () => {
    const f = setup();
    await f.user.click(f.digest());
    await f.user.click(f.save());
    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("link", { name: "Choose a digest day" })).toBeInTheDocument();
    expect(errorFor(screen.getByLabelText("Digest day"))).toHaveTextContent("Choose a digest day");

    await f.user.click(f.digest());
    expect(screen.queryByLabelText("Digest day")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose a digest day")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Re-checking starts fresh: no stale error.
    await f.user.click(f.digest());
    expect(errorFor(screen.getByLabelText("Digest day"))).toBeNull();
  });

  it("saves the chosen day", async () => {
    const f = setup({ saveDelayMs: 0 });
    await f.user.click(f.digest());
    await f.user.selectOptions(screen.getByLabelText("Digest day"), "Friday");
    await f.user.click(f.save());
    await screen.findByText("Settings saved");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toMatchObject({ weeklyDigest: true, digestDay: "fri" });
  });
});

describe("submit with errors", () => {
  it("shows a focused error summary linking to each invalid field, and marks fields invalid", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.clear(f.tokens());
    await f.user.type(f.tokens(), "100.5");
    await f.user.click(f.save());

    const alert = screen.getByRole("alert");
    expect(within(alert).getByRole("heading", { name: "There is a problem" })).toBeInTheDocument();
    expect(alert).toHaveFocus();

    const links = within(alert).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#display-name", "#max-tokens"]);
    expect(links[0]).toHaveTextContent("Enter a display name");
    expect(links[1]).toHaveTextContent("Max response length must be a whole number");

    for (const el of [f.name(), f.tokens()]) {
      expect(el).toHaveAttribute("aria-invalid", "true");
      const err = errorFor(el)!;
      expect(err).toBeInTheDocument();
      expect(el.getAttribute("aria-describedby")).toContain(err.id);
    }
    expect(f.name()).toHaveAccessibleDescription(expect.stringContaining("Enter a display name"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("summary links move focus to the field", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.click(f.save());
    await f.user.click(within(screen.getByRole("alert")).getByRole("link", { name: "Enter a display name" }));
    expect(f.name()).toHaveFocus();
  });

  it("fields from a failed submit re-validate on change and drop out of the summary when fixed", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.clear(f.tokens());
    await f.user.type(f.tokens(), "100.5");
    await f.user.click(f.save());
    await f.user.type(f.name(), "Ada");
    expect(errorFor(f.name())).toBeNull();
    const links = within(screen.getByRole("alert")).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#max-tokens"]);
  });
});

describe("valid submit", () => {
  it("saves to localStorage, announces 'Settings saved' and blocks double submit while saving", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const f = setup(); // default 400 ms simulated save
    await f.user.clear(f.name());
    await f.user.type(f.name(), "Ada");

    await f.user.click(f.save());
    expect(f.save()).toHaveTextContent("Saving…");
    expect(f.save()).toHaveAttribute("aria-disabled", "true");
    await f.user.click(f.save());
    await f.user.keyboard("{Enter}");

    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Settings saved"));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ ...DEFAULT_SETTINGS, displayName: "Ada" });
    expect(f.save()).toHaveTextContent("Save");
  });

  it("ignores a second submit fired before React re-renders (ref guard, not just the button state)", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const f = setup({ saveDelayMs: 50 });
    await f.user.clear(f.name());
    await f.user.type(f.name(), "Ada");
    const form = f.name().closest("form")!;
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await screen.findByText("Settings saved");
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("shows \"Couldn't save on this device\" when storage throws, without crashing", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    const f = setup({ saveDelayMs: 0 });
    await f.user.clear(f.name());
    await f.user.type(f.name(), "Ada");
    await f.user.click(f.save());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't save on this device"));
    expect(screen.queryByText("Settings saved")).not.toBeInTheDocument();
    // The form is still usable and still dirty, so the user can retry.
    expect(f.name()).toHaveValue("Ada");
    expect(f.save()).toHaveAttribute("aria-disabled", "false");
  });
});

describe("loading saved values", () => {
  it("loads valid saved values on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, displayName: "Ada", model: "fast", temperature: 0.2, maxTokens: 300, weeklyDigest: true, digestDay: "wed" }),
    );
    const f = setup();
    expect(f.name()).toHaveValue("Ada");
    expect(screen.getByRole("radio", { name: /Fast/ })).toBeChecked();
    expect(f.temp()).toHaveValue("0.2");
    expect(f.slider()).toHaveValue("0.2");
    expect(f.tokens()).toHaveValue("300");
    expect(screen.getByLabelText("Digest day")).toHaveValue("wed");
    expect(f.save()).toHaveAttribute("aria-disabled", "true");
  });

  it("falls back to defaults for corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{oops");
    const f = setup();
    expect(f.name()).toHaveValue("Assistant");
    expect(screen.getByRole("radio", { name: /Balanced/ })).toBeChecked();
  });

  it("falls back to defaults for well-formed but invalid data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, temperature: 7, displayName: "Ada" }));
    const f = setup();
    expect(f.name()).toHaveValue("Assistant");
    expect(f.temp()).toHaveValue("0.7");
  });

  it("falls back to defaults when reading storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const f = setup();
    expect(f.name()).toHaveValue("Assistant");
  });
});

describe("reset", () => {
  it("restores defaults and clears errors when nothing was saved", async () => {
    const f = setup();
    await f.user.clear(f.name());
    await f.user.click(f.save());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await f.user.click(f.reset());
    expect(f.name()).toHaveValue("Assistant");
    expect(f.name()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter a display name")).not.toBeInTheDocument();
  });

  it("restores the last saved values, including the slider", async () => {
    const f = setup({ saveDelayMs: 0 });
    await f.user.clear(f.name());
    await f.user.type(f.name(), "Ada");
    fireEvent.change(f.slider(), { target: { value: "0.3" } });
    await f.user.click(f.save());
    await screen.findByText("Settings saved");

    await f.user.clear(f.name());
    await f.user.type(f.name(), "Bob");
    await f.user.clear(f.temp());
    await f.user.type(f.temp(), "abc");
    await f.user.tab();
    await f.user.click(f.reset());

    expect(f.name()).toHaveValue("Ada");
    expect(f.temp()).toHaveValue("0.3");
    expect(f.slider()).toHaveValue("0.3");
    expect(errorFor(f.temp())).toBeNull();
    // Reset leaves nothing to save.
    expect(f.save()).toHaveAttribute("aria-disabled", "true");
  });
});

describe("save button is disabled until the form differs from the last saved values", () => {
  it("is aria-disabled and does nothing on a pristine form", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const f = setup({ saveDelayMs: 0 });
    expect(f.save()).toHaveAttribute("aria-disabled", "true");
    expect(f.save()).not.toBeDisabled(); // stays focusable
    await f.user.click(f.save());
    await new Promise((r) => setTimeout(r, 20));
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("a submit that bypasses the button (e.g. implicit submission) is also ignored on a pristine form", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const f = setup({ saveDelayMs: 0 });
    act(() => f.name().closest("form")!.requestSubmit());
    await new Promise((r) => setTimeout(r, 20));
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("enables on change and disables again when changed back or after saving", async () => {
    const f = setup({ saveDelayMs: 0 });
    await f.user.click(screen.getByRole("radio", { name: /Smart/ }));
    expect(f.save()).toHaveAttribute("aria-disabled", "false");
    await f.user.click(screen.getByRole("radio", { name: /Balanced/ }));
    expect(f.save()).toHaveAttribute("aria-disabled", "true");
    await f.user.click(screen.getByRole("radio", { name: /Smart/ }));
    await f.user.click(f.save());
    await screen.findByText("Settings saved");
    expect(f.save()).toHaveAttribute("aria-disabled", "true");
  });
});

describe("blur → Save (the swallowed-click bug)", () => {
  it("doesn't show a blur error when focus moves to Save, so the click isn't lost; submit shows it", async () => {
    const { user, temp: getTemp } = setup();
    const temp = getTemp();
    await user.clear(temp);
    await user.type(temp, "abc");
    const save = screen.getByRole("button", { name: /save/i });
    // Blur straight onto Save: no field error yet (no layout shift under the pointer)…
    temp.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: save }));
    expect(screen.queryByText(/must be a number/i)).toBeNull();
    // …and the click submits, showing the summary.
    await user.click(save);
    expect(await screen.findByRole("alert")).toHaveTextContent(/There is a problem/);
  });
});
