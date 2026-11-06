import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "./SettingsForm";
import { validateSettings, type Settings } from "./validate";

const valid: Settings = {
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  website: "https://ada.dev",
  bio: "Mathematician.",
  timezone: "UTC",
  emailNotifications: true,
};

describe("validateSettings", () => {
  it("accepts valid settings", () => {
    expect(validateSettings(valid)).toEqual({});
  });

  it("allows an empty website", () => {
    expect(validateSettings({ ...valid, website: "" })).toEqual({});
  });

  it("flags each invalid field", () => {
    const errors = validateSettings({
      displayName: " ",
      email: "ada@",
      website: "ada.dev",
      bio: "x".repeat(161),
      timezone: "",
      emailNotifications: false,
    });
    expect(Object.keys(errors).sort()).toEqual(["bio", "displayName", "email", "timezone", "website"]);
  });

  it("enforces display name length", () => {
    expect(validateSettings({ ...valid, displayName: "A" }).displayName).toMatch(/at least 2/);
    expect(validateSettings({ ...valid, displayName: "A".repeat(51) }).displayName).toMatch(/50 characters/);
  });
});

describe("SettingsForm", () => {
  it("shows errors on submit, marks fields invalid and focuses the first one", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Save settings" }));

    const name = screen.getByLabelText(/Display name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter a display name.");
    expect(name).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription("Enter an email address.");
    expect(screen.getByLabelText(/Time zone/)).toHaveAttribute("aria-invalid", "true");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("validates a field on blur and clears the error once fixed", async () => {
    const user = userEvent.setup();
    render(<SettingsForm onSave={vi.fn()} />);

    const email = screen.getByRole("textbox", { name: "Email" });
    await user.type(email, "ada@");
    await user.tab();
    expect(email).toHaveAttribute("aria-invalid", "true");

    await user.type(email, "example.com");
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/name@example.com/)).not.toBeInTheDocument();
  });

  it("saves valid settings and announces success", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/Display name/), "  Ada  ");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await user.selectOptions(screen.getByLabelText(/Time zone/), "Asia/Jakarta");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Ada", timezone: "Asia/Jakarta" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.");
  });

  it("announces a failed save", async () => {
    const user = userEvent.setup();
    render(<SettingsForm initial={valid} onSave={vi.fn().mockRejectedValue(new Error("nope"))} />);

    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't save your settings.");
  });

  it("counts bio characters left", async () => {
    const user = userEvent.setup();
    render(<SettingsForm onSave={vi.fn()} />);
    await user.type(screen.getByLabelText("Bio"), "Hello");
    expect(screen.getByText("155 characters left")).toBeInTheDocument();
  });
});
