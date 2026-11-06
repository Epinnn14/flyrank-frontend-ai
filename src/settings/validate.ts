// Pure validation and persistence helpers for the assistant settings form. No React in here.

export const STORAGE_KEY = "assistant-settings:v1";

export const MODELS = ["fast", "balanced", "smart"] as const;
export type Model = (typeof MODELS)[number];

export const DAYS = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
] as const;
export type DigestDay = (typeof DAYS)[number]["value"];

export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const TEMP_MIN = 0;
export const TEMP_MAX = 1;
export const TOKENS_MIN = 64;
export const TOKENS_MAX = 4096;
export const PROMPT_MAX = 2000;

/** What is persisted: real types. */
export interface Settings {
  displayName: string;
  model: Model;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  weeklyDigest: boolean;
  digestDay: DigestDay | null;
}

/** What the form edits: free text for numeric fields so invalid input ("abc") can be held and reported. */
export interface FormValues {
  displayName: string;
  model: Model;
  temperature: string;
  maxTokens: string;
  systemPrompt: string;
  weeklyDigest: boolean;
  digestDay: DigestDay | "";
}

export type FieldName = "displayName" | "model" | "temperature" | "maxTokens" | "systemPrompt" | "digestDay";
export type Errors = Partial<Record<FieldName, string>>;

/** Order used by the error summary (matches the visual order of the form). */
export const FIELD_ORDER: readonly FieldName[] = [
  "displayName",
  "model",
  "temperature",
  "maxTokens",
  "systemPrompt",
  "digestDay",
];

/** DOM id of the control each summary link points at. For the radio group it is the first radio. */
export const FIELD_IDS: Record<FieldName, string> = {
  displayName: "display-name",
  model: "model-fast",
  temperature: "temperature",
  maxTokens: "max-tokens",
  systemPrompt: "system-prompt",
  digestDay: "digest-day",
};

export const DEFAULT_SETTINGS: Settings = {
  displayName: "Assistant",
  model: "balanced",
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: "",
  weeklyDigest: false,
  digestDay: null,
};

/** Counts user-perceived characters more fairly than UTF-16 length (an emoji counts once). */
export function charCount(value: string): number {
  return Array.from(value).length;
}

export function validateDisplayName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return "Enter a display name";
  const n = charCount(trimmed);
  if (n < NAME_MIN) return `Display name must be at least ${NAME_MIN} characters`;
  if (n > NAME_MAX) return `Display name must be ${NAME_MAX} characters or fewer`;
  return undefined;
}

export function isModel(value: unknown): value is Model {
  return typeof value === "string" && (MODELS as readonly string[]).includes(value);
}

export function validateModel(value: string): string | undefined {
  return isModel(value) ? undefined : "Choose a model";
}

const DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)$/;

export function validateTemperature(value: string): string | undefined {
  const text = value.trim();
  if (text === "") return "Enter a temperature";
  if (!DECIMAL.test(text)) return "Temperature must be a number, like 0.7";
  const n = Number(text);
  if (n < TEMP_MIN || n > TEMP_MAX) return `Temperature must be between ${TEMP_MIN} and ${TEMP_MAX}`;
  if (Math.abs(n * 10 - Math.round(n * 10)) > 1e-9) return "Temperature must be in steps of 0.1, like 0.7";
  return undefined;
}

/** Returns the temperature rounded to one decimal if the text is valid, otherwise null. */
export function parseTemperature(value: string): number | null {
  if (validateTemperature(value)) return null;
  return Math.round(Number(value.trim()) * 10) / 10;
}

export function validateMaxTokens(value: string): string | undefined {
  const text = value.trim();
  if (text === "") return "Enter a max response length";
  if (!DECIMAL.test(text)) return "Max response length must be a number, like 1024";
  if (!/^-?\d+$/.test(text)) return "Max response length must be a whole number";
  const n = Number(text);
  if (n < TOKENS_MIN || n > TOKENS_MAX) {
    return `Max response length must be between ${TOKENS_MIN} and ${TOKENS_MAX} tokens`;
  }
  return undefined;
}

export function validateSystemPrompt(value: string): string | undefined {
  const n = charCount(value);
  if (n > PROMPT_MAX) return `System prompt must be ${PROMPT_MAX} characters or fewer (${n - PROMPT_MAX} over)`;
  return undefined;
}

export function isDigestDay(value: unknown): value is DigestDay {
  return typeof value === "string" && DAYS.some((d) => d.value === value);
}

/** The day is only required (and only validated) while the weekly digest is on. */
export function validateDigestDay(day: string, weeklyDigest: boolean): string | undefined {
  if (!weeklyDigest) return undefined;
  return isDigestDay(day) ? undefined : "Choose a digest day";
}

export function validateField(name: FieldName, values: FormValues): string | undefined {
  switch (name) {
    case "displayName":
      return validateDisplayName(values.displayName);
    case "model":
      return validateModel(values.model);
    case "temperature":
      return validateTemperature(values.temperature);
    case "maxTokens":
      return validateMaxTokens(values.maxTokens);
    case "systemPrompt":
      return validateSystemPrompt(values.systemPrompt);
    case "digestDay":
      return validateDigestDay(values.digestDay, values.weeklyDigest);
  }
}

export function validateAll(values: FormValues): Errors {
  const errors: Errors = {};
  for (const name of FIELD_ORDER) {
    const message = validateField(name, values);
    if (message) errors[name] = message;
  }
  return errors;
}

export function hasErrors(errors: Errors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toFormValues(s: Settings): FormValues {
  return {
    displayName: s.displayName,
    model: s.model,
    temperature: String(s.temperature),
    maxTokens: String(s.maxTokens),
    systemPrompt: s.systemPrompt,
    weeklyDigest: s.weeklyDigest,
    digestDay: s.weeklyDigest && s.digestDay ? s.digestDay : "",
  };
}

/** Converts valid form values to settings. Call only after validateAll returned no errors. */
export function toSettings(v: FormValues): Settings {
  return {
    displayName: v.displayName.trim(),
    model: v.model,
    temperature: parseTemperature(v.temperature) ?? DEFAULT_SETTINGS.temperature,
    maxTokens: Number(v.maxTokens.trim()),
    systemPrompt: v.systemPrompt,
    weeklyDigest: v.weeklyDigest,
    digestDay: v.weeklyDigest && isDigestDay(v.digestDay) ? v.digestDay : null,
  };
}

export function formValuesEqual(a: FormValues, b: FormValues): boolean {
  return (Object.keys(a) as (keyof FormValues)[]).every((k) => a[k] === b[k]);
}

/** Parses a stored JSON string. Returns null for missing, corrupt, wrongly shaped or invalid data. */
export function parseStoredSettings(raw: string | null): Settings | null {
  if (raw == null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.displayName !== "string" ||
    !isModel(d.model) ||
    typeof d.temperature !== "number" ||
    typeof d.maxTokens !== "number" ||
    typeof d.systemPrompt !== "string" ||
    typeof d.weeklyDigest !== "boolean" ||
    !(d.digestDay === null || d.digestDay === undefined || isDigestDay(d.digestDay))
  ) {
    return null;
  }
  const candidate: Settings = {
    displayName: d.displayName,
    model: d.model,
    temperature: d.temperature,
    maxTokens: d.maxTokens,
    systemPrompt: d.systemPrompt,
    weeklyDigest: d.weeklyDigest,
    digestDay: (d.digestDay as DigestDay | null | undefined) ?? null,
  };
  // Reuse the form rules so stored data obeys exactly the same limits (this also rejects digest-on-without-day).
  if (hasErrors(validateAll(toFormValues(candidate)))) return null;
  return toSettings(toFormValues(candidate));
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Returns window.localStorage, or null when touching it throws (privacy modes, blocked storage). */
export function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Reads saved settings. Never throws; falls back to null so callers use defaults. */
export function loadSettings(storage: StorageLike | null): Settings | null {
  if (!storage) return null;
  try {
    return parseStoredSettings(storage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Writes settings. Never throws; returns false when the write failed. */
export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
