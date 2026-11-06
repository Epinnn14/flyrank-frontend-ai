import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import "./AssistantSettings.css";
import {
  DAYS,
  DEFAULT_SETTINGS,
  FIELD_IDS,
  FIELD_ORDER,
  PROMPT_MAX,
  TEMP_MAX,
  TEMP_MIN,
  TOKENS_MAX,
  TOKENS_MIN,
  charCount,
  formValuesEqual,
  getBrowserStorage,
  hasErrors,
  isDigestDay,
  loadSettings,
  parseTemperature,
  saveSettings,
  toFormValues,
  toSettings,
  validateAll,
  validateField,
} from "./validate";
import type { Errors, FieldName, FormValues, Model } from "./validate";

const MODEL_OPTIONS: { value: Model; label: string; hint: string }[] = [
  { value: "fast", label: "Fast", hint: "Quickest replies, lighter reasoning." },
  { value: "balanced", label: "Balanced", hint: "A good mix of speed and quality." },
  { value: "smart", label: "Smart", hint: "Most capable, a little slower." },
];

type Status = { kind: "success" | "error"; text: string } | null;

export interface AssistantSettingsProps {
  /** Simulated network latency for saving. */
  saveDelayMs?: number;
}

function loadInitialValues(): FormValues {
  return toFormValues(loadSettings(getBrowserStorage()) ?? DEFAULT_SETTINGS);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function AssistantSettings({ saveDelayMs = 400 }: AssistantSettingsProps) {
  const [saved, setSaved] = useState<FormValues>(loadInitialValues);
  const [values, setValues] = useState<FormValues>(saved);
  const [sliderTemp, setSliderTemp] = useState<number>(
    () => parseTemperature(saved.temperature) ?? DEFAULT_SETTINGS.temperature,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [summaryFields, setSummaryFields] = useState<FieldName[]>([]);
  const [summaryFocusToken, setSummaryFocusToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (summaryFocusToken > 0) summaryRef.current?.focus();
  }, [summaryFocusToken]);

  const dirty = useMemo(() => !formValuesEqual(values, saved), [values, saved]);
  const saveBlocked = !dirty || saving;

  // Summary lists the fields from the last failed submit that are still invalid, with their current message.
  const summaryItems = summaryFields.filter((f) => errors[f]);

  function setFieldError(name: FieldName, message: string | undefined) {
    setErrors((prev) => {
      if (prev[name] === message) return prev;
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  /** Applies a change. Re-validates the field if it was blurred before (or if `always` is set). */
  function update(patch: Partial<FormValues>, field?: FieldName, always = false) {
    const next = { ...values, ...patch };
    setValues(next);
    setStatus(null);
    if (field && (always || touched[field])) setFieldError(field, validateField(field, next));
  }

  function handleBlur(field: FieldName) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldError(field, validateField(field, values));
  }

  function handleTemperatureText(e: ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    const parsed = parseTemperature(text);
    if (parsed !== null) setSliderTemp(parsed);
    update({ temperature: text }, "temperature");
  }

  function handleTemperatureSlider(e: ChangeEvent<HTMLInputElement>) {
    const n = Math.round(Number(e.target.value) * 10) / 10;
    setSliderTemp(n);
    // The slider can only produce valid values, so always re-validate (clears a stale error).
    update({ temperature: String(n) }, "temperature", true);
  }

  function handleDigestToggle(e: ChangeEvent<HTMLInputElement>) {
    const on = e.target.checked;
    if (on) {
      update({ weeklyDigest: true });
    } else {
      // The day field is removed: drop its value, its error and its touched flag.
      update({ weeklyDigest: false, digestDay: "" });
      setFieldError("digestDay", undefined);
      setTouched((prev) => ({ ...prev, digestDay: false }));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current || !dirty) return;

    const all = validateAll(values);
    if (hasErrors(all)) {
      setErrors(all);
      setTouched(Object.fromEntries(FIELD_ORDER.map((f) => [f, true])));
      setSummaryFields(FIELD_ORDER.filter((f) => all[f]));
      setSummaryFocusToken((t) => t + 1);
      setStatus(null);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setErrors({});
    setSummaryFields([]);
    setStatus(null);

    const snapshot = values;
    const settings = toSettings(snapshot);
    await wait(saveDelayMs);
    const ok = saveSettings(getBrowserStorage(), settings);

    savingRef.current = false;
    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      const normalized = toFormValues(settings);
      setSaved(normalized);
      // Keep any edits made while saving; otherwise show the normalised (trimmed) values.
      setValues((cur) => (formValuesEqual(cur, snapshot) ? normalized : cur));
      setStatus({ kind: "success", text: "Settings saved" });
    } else {
      setStatus({ kind: "error", text: "Couldn't save on this device" });
    }
  }

  function handleSaveClick(e: MouseEvent<HTMLButtonElement>) {
    if (saveBlocked) e.preventDefault();
  }

  function handleReset() {
    if (savingRef.current) return;
    setValues(saved);
    setSliderTemp(parseTemperature(saved.temperature) ?? DEFAULT_SETTINGS.temperature);
    setErrors({});
    setTouched({});
    setSummaryFields([]);
    setStatus(null);
  }

  function focusField(e: MouseEvent<HTMLAnchorElement>, field: FieldName) {
    const el = document.getElementById(FIELD_IDS[field]);
    if (!el) return;
    e.preventDefault();
    el.focus();
    el.closest(".field")?.scrollIntoView?.({ block: "center" });
  }

  /** aria props for a control: invalid flag plus describedby (hint ids first, then the error). */
  function a11y(field: FieldName, ...hintIds: string[]) {
    const error = errors[field];
    const ids = [...hintIds, error ? `${FIELD_IDS[field]}-error` : ""].filter(Boolean);
    return {
      "aria-invalid": error ? (true as const) : undefined,
      "aria-describedby": ids.length ? ids.join(" ") : undefined,
    };
  }

  function errorText(field: FieldName) {
    const error = errors[field];
    if (!error) return null;
    return (
      <p id={`${FIELD_IDS[field]}-error`} className="field-error">
        <span className="visually-hidden">Error: </span>
        {error}
      </p>
    );
  }

  const promptLeft = PROMPT_MAX - charCount(values.systemPrompt);

  return (
    <section className="assistant-settings" aria-labelledby="settings-title">
      <h1 id="settings-title">Assistant settings</h1>
      <p className="muted">Choose how your AI chat assistant talks to you.</p>

      {summaryItems.length > 0 && (
        <div
          ref={summaryRef}
          className="error-summary"
          role="alert"
          aria-labelledby="error-summary-title"
          tabIndex={-1}
        >
          <h2 id="error-summary-title">There is a problem</h2>
          <ul>
            {summaryItems.map((f) => (
              <li key={f}>
                <a href={`#${FIELD_IDS[f]}`} onClick={(e) => focusField(e, f)}>
                  {errors[f]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="card settings-form" noValidate onSubmit={handleSubmit} aria-labelledby="settings-title">
        <div className={`field${errors.displayName ? " has-error" : ""}`}>
          <label htmlFor="display-name">Display name</label>
          <p id="display-name-hint" className="hint">
            What the assistant calls itself. 2 to 40 characters.
          </p>
          {errorText("displayName")}
          <input
            id="display-name"
            name="displayName"
            type="text"
            autoComplete="off"
            value={values.displayName}
            onChange={(e) => update({ displayName: e.target.value }, "displayName")}
            onBlur={() => handleBlur("displayName")}
            {...a11y("displayName", "display-name-hint")}
          />
        </div>

        <fieldset
          className={`field radio-group${errors.model ? " has-error" : ""}`}
          {...a11y("model")}
        >
          <legend>Model</legend>
          {errorText("model")}
          <div className="radio-options">
            {MODEL_OPTIONS.map((m) => (
              <div className="radio-option" key={m.value}>
                <input
                  id={`model-${m.value}`}
                  type="radio"
                  name="model"
                  value={m.value}
                  checked={values.model === m.value}
                  onChange={() => update({ model: m.value }, "model")}
                  onBlur={() => handleBlur("model")}
                  aria-describedby={`model-${m.value}-hint`}
                />
                <label htmlFor={`model-${m.value}`}>
                  <span className="radio-label">{m.label}</span>
                  <span id={`model-${m.value}-hint`} className="hint">
                    {m.hint}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <div className={`field${errors.temperature ? " has-error" : ""}`}>
          <label htmlFor="temperature">Temperature</label>
          <p id="temperature-hint" className="hint">
            0 is focused and predictable, 1 is more creative. Steps of 0.1.
          </p>
          {errorText("temperature")}
          <div className="temperature-row">
            <label htmlFor="temperature-slider" className="visually-hidden">
              Temperature slider
            </label>
            <input
              id="temperature-slider"
              type="range"
              min={TEMP_MIN}
              max={TEMP_MAX}
              step={0.1}
              value={sliderTemp}
              onChange={handleTemperatureSlider}
              aria-describedby="temperature-hint"
            />
            <input
              id="temperature"
              name="temperature"
              className="number-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values.temperature}
              onChange={handleTemperatureText}
              onBlur={() => handleBlur("temperature")}
              {...a11y("temperature", "temperature-hint")}
            />
          </div>
        </div>

        <div className={`field${errors.maxTokens ? " has-error" : ""}`}>
          <label htmlFor="max-tokens">Max response length (tokens)</label>
          <p id="max-tokens-hint" className="hint">
            A whole number from {TOKENS_MIN} to {TOKENS_MAX}.
          </p>
          {errorText("maxTokens")}
          <input
            id="max-tokens"
            name="maxTokens"
            className="number-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.maxTokens}
            onChange={(e) => update({ maxTokens: e.target.value }, "maxTokens")}
            onBlur={() => handleBlur("maxTokens")}
            {...a11y("maxTokens", "max-tokens-hint")}
          />
        </div>

        <div className={`field${errors.systemPrompt ? " has-error" : ""}`}>
          <label htmlFor="system-prompt">
            System prompt <span className="optional">(optional)</span>
          </label>
          <p id="system-prompt-hint" className="hint">
            Instructions the assistant follows in every chat. Up to {PROMPT_MAX} characters.
          </p>
          {errorText("systemPrompt")}
          <textarea
            id="system-prompt"
            name="systemPrompt"
            rows={6}
            value={values.systemPrompt}
            // The length limit is shown live (not only after blur) so a long paste is flagged immediately.
            onChange={(e) => update({ systemPrompt: e.target.value }, "systemPrompt", true)}
            onBlur={() => handleBlur("systemPrompt")}
            {...a11y("systemPrompt", "system-prompt-hint", "system-prompt-count")}
          />
          <p id="system-prompt-count" className={`counter${promptLeft < 0 ? " over" : ""}`}>
            {promptLeft >= 0
              ? `${promptLeft} ${promptLeft === 1 ? "character" : "characters"} left`
              : `${-promptLeft} ${promptLeft === -1 ? "character" : "characters"} too many`}
          </p>
        </div>

        <div className="field">
          <div className="checkbox-row">
            <input
              id="weekly-digest"
              name="weeklyDigest"
              type="checkbox"
              checked={values.weeklyDigest}
              onChange={handleDigestToggle}
              aria-describedby="weekly-digest-hint"
            />
            <label htmlFor="weekly-digest">Send me a weekly digest</label>
          </div>
          <p id="weekly-digest-hint" className="hint">
            A summary of your conversations, once a week.
          </p>
        </div>

        {values.weeklyDigest && (
          <div className={`field nested${errors.digestDay ? " has-error" : ""}`}>
            <label htmlFor="digest-day">Digest day</label>
            {errorText("digestDay")}
            <select
              id="digest-day"
              name="digestDay"
              value={values.digestDay}
              onChange={(e) =>
                update({ digestDay: isDigestDay(e.target.value) ? e.target.value : "" }, "digestDay")
              }
              onBlur={() => handleBlur("digestDay")}
              {...a11y("digestDay")}
            >
              <option value="">Choose a day</option>
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="actions">
          <button
            type="submit"
            className="button primary"
            aria-disabled={saveBlocked}
            onClick={handleSaveClick}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="button secondary" onClick={handleReset} aria-disabled={saving}>
            Reset
          </button>
        </div>

        <div role="status" className="status-region">
          {status && (
            <p key={status.text} className={`status ${status.kind}`}>
              {status.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
