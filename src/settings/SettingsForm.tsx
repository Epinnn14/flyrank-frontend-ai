import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { BIO_MAX, TIMEZONES, validateField, validateSettings, type Settings, type SettingsErrors } from "./validate";
import "./SettingsForm.css";

const FIELD_ORDER: (keyof Settings)[] = ["displayName", "email", "website", "bio", "timezone"];

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  email: "",
  website: "",
  bio: "",
  timezone: "",
  emailNotifications: true,
};

type Props = {
  initial?: Settings;
  /** Persists the settings. Defaults to a short fake delay, since there is no backend. */
  onSave?: (settings: Settings) => Promise<void>;
};

const fakeSave = () => new Promise<void>((resolve) => setTimeout(resolve, 600));

export function SettingsForm({ initial = DEFAULT_SETTINGS, onSave = fakeSave }: Props) {
  const [values, setValues] = useState<Settings>(initial);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Settings, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  function update<K extends keyof Settings>(field: K, value: Settings[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    setStatus("idle");
    // Once a field has been left, re-check it as the user types so the error clears as soon as it is fixed.
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validateField(field, value) }));
  }

  function onText(field: "displayName" | "email" | "website" | "bio" | "timezone") {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => update(field, e.target.value);
  }

  function onBlur(field: keyof Settings) {
    return () => {
      setTouched((t) => ({ ...t, [field]: true }));
      setErrors((e) => ({ ...e, [field]: validateField(field, values[field]) }));
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "saving") return;
    const found = validateSettings(values);
    setErrors(found);
    setTouched(Object.fromEntries(FIELD_ORDER.map((f) => [f, true])));
    const firstInvalid = FIELD_ORDER.find((f) => found[f]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    setStatus("saving");
    try {
      await onSave({ ...values, displayName: values.displayName.trim(), email: values.email.trim(), website: values.website.trim() });
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  function describedBy(field: keyof Settings, hint?: string) {
    const ids = [hint, errors[field] ? `${field}-error` : undefined].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  }

  function errorFor(field: keyof Settings) {
    return errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;
  }

  const bioLeft = BIO_MAX - values.bio.length;

  return (
    <form ref={formRef} className="settings card" noValidate onSubmit={onSubmit} aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>

      <div className="field">
        <label htmlFor="displayName">
          Display name <span aria-hidden="true">*</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          value={values.displayName}
          onChange={onText("displayName")}
          onBlur={onBlur("displayName")}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={describedBy("displayName")}
        />
        {errorFor("displayName")}
      </div>

      <div className="field">
        <label htmlFor="email">
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          onChange={onText("email")}
          onBlur={onBlur("email")}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email")}
        />
        {errorFor("email")}
      </div>

      <div className="field">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="url"
          autoComplete="url"
          placeholder="https://"
          value={values.website}
          onChange={onText("website")}
          onBlur={onBlur("website")}
          aria-invalid={errors.website ? true : undefined}
          aria-describedby={describedBy("website", "website-hint")}
        />
        <p id="website-hint" className="field-hint">Optional.</p>
        {errorFor("website")}
      </div>

      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          value={values.bio}
          onChange={onText("bio")}
          onBlur={onBlur("bio")}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={describedBy("bio", "bio-hint")}
        />
        <p id="bio-hint" className={bioLeft < 0 ? "field-hint over" : "field-hint"}>
          {bioLeft >= 0 ? `${bioLeft} characters left` : `${-bioLeft} characters over the limit`}
        </p>
        {errorFor("bio")}
      </div>

      <div className="field">
        <label htmlFor="timezone">
          Time zone <span aria-hidden="true">*</span>
        </label>
        <select
          id="timezone"
          name="timezone"
          required
          value={values.timezone}
          onChange={onText("timezone")}
          onBlur={onBlur("timezone")}
          aria-invalid={errors.timezone ? true : undefined}
          aria-describedby={describedBy("timezone")}
        >
          <option value="">Select…</option>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {errorFor("timezone")}
      </div>

      <div className="field field-check">
        <input
          id="emailNotifications"
          name="emailNotifications"
          type="checkbox"
          checked={values.emailNotifications}
          onChange={(e) => update("emailNotifications", e.target.checked)}
        />
        <label htmlFor="emailNotifications">Email me about account activity</label>
      </div>

      <p className="field-hint">
        <span aria-hidden="true">*</span> Required
      </p>

      <div className="actions">
        <button type="submit" className="save" aria-disabled={status === "saving" || undefined}>
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        <p role="status" className={`form-status ${status}`}>
          {status === "saved" && "Settings saved."}
          {status === "failed" && "Couldn't save your settings. Try again."}
        </p>
      </div>
    </form>
  );
}
