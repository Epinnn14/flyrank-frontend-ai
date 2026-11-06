import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  formValuesEqual,
  loadSettings,
  parseStoredSettings,
  parseTemperature,
  saveSettings,
  toFormValues,
  toSettings,
  validateAll,
  validateDigestDay,
  validateDisplayName,
  validateMaxTokens,
  validateModel,
  validateSystemPrompt,
  validateTemperature,
} from "./validate";
import type { FormValues, Settings } from "./validate";

const validValues = (): FormValues => toFormValues(DEFAULT_SETTINGS);

describe("rule 1: display name", () => {
  it("is required", () => {
    expect(validateDisplayName("")).toBe("Enter a display name");
  });
  it("treats whitespace-only as required", () => {
    expect(validateDisplayName("   \t ")).toBe("Enter a display name");
  });
  it("needs at least 2 characters after trimming", () => {
    expect(validateDisplayName(" a ")).toMatch(/at least 2/);
    expect(validateDisplayName(" ab ")).toBeUndefined();
  });
  it("allows at most 40 characters after trimming", () => {
    expect(validateDisplayName("x".repeat(40))).toBeUndefined();
    expect(validateDisplayName(`  ${"x".repeat(40)}  `)).toBeUndefined();
    expect(validateDisplayName("x".repeat(41))).toMatch(/40 characters or fewer/);
  });
  it("is trimmed when converted to settings", () => {
    expect(toSettings({ ...validValues(), displayName: "  Ada  " }).displayName).toBe("Ada");
  });
});

describe("rule 2: model", () => {
  it("accepts fast, balanced and smart", () => {
    for (const m of ["fast", "balanced", "smart"]) expect(validateModel(m)).toBeUndefined();
  });
  it("rejects anything else", () => {
    expect(validateModel("turbo")).toBe("Choose a model");
    expect(validateModel("")).toBe("Choose a model");
  });
  it("defaults to balanced", () => {
    expect(DEFAULT_SETTINGS.model).toBe("balanced");
  });
});

describe("rule 3: temperature", () => {
  it.each(["0", "0.0", "0.1", "0.5", ".7", "1", "1.0", " 0.3 "])("accepts %j", (v) => {
    expect(validateTemperature(v)).toBeUndefined();
  });
  it("is required", () => {
    expect(validateTemperature("")).toBe("Enter a temperature");
  });
  it("rejects non-numbers like abc", () => {
    expect(validateTemperature("abc")).toMatch(/must be a number/);
    expect(validateTemperature("0.5x")).toMatch(/must be a number/);
    expect(validateTemperature("1e-1")).toMatch(/must be a number/);
  });
  it("rejects values outside 0–1 such as 1.5 and -0.1", () => {
    expect(validateTemperature("1.5")).toMatch(/between 0 and 1/);
    expect(validateTemperature("-0.1")).toMatch(/between 0 and 1/);
  });
  it("rejects values that are not in steps of 0.1", () => {
    expect(validateTemperature("0.25")).toMatch(/steps of 0.1/);
  });
  it("parseTemperature returns a number only for valid text", () => {
    expect(parseTemperature("0.3")).toBe(0.3);
    expect(parseTemperature("abc")).toBeNull();
    expect(parseTemperature("1.5")).toBeNull();
  });
});

describe("rule 4: max response length", () => {
  it.each(["64", "1024", "4096", " 512 "])("accepts %j", (v) => {
    expect(validateMaxTokens(v)).toBeUndefined();
  });
  it("is required", () => {
    expect(validateMaxTokens("")).toMatch(/Enter a max response length/);
  });
  it("rejects decimals like 100.5", () => {
    expect(validateMaxTokens("100.5")).toBe("Max response length must be a whole number");
  });
  it("rejects non-numbers", () => {
    expect(validateMaxTokens("lots")).toMatch(/must be a number/);
  });
  it("rejects values outside 64–4096", () => {
    expect(validateMaxTokens("63")).toMatch(/between 64 and 4096/);
    expect(validateMaxTokens("4097")).toMatch(/between 64 and 4096/);
  });
});

describe("rule 5: system prompt", () => {
  it("is optional", () => {
    expect(validateSystemPrompt("")).toBeUndefined();
  });
  it("allows exactly 2000 characters", () => {
    expect(validateSystemPrompt("a".repeat(2000))).toBeUndefined();
  });
  it("rejects 5000 characters and says how far over it is", () => {
    expect(validateSystemPrompt("a".repeat(5000))).toBe(
      "System prompt must be 2000 characters or fewer (3000 over)",
    );
  });
});

describe("rule 6: weekly digest day", () => {
  it("is required when the digest is on", () => {
    expect(validateDigestDay("", true)).toBe("Choose a digest day");
    expect(validateDigestDay("someday", true)).toBe("Choose a digest day");
    expect(validateDigestDay("mon", true)).toBeUndefined();
    expect(validateDigestDay("sun", true)).toBeUndefined();
  });
  it("is ignored when the digest is off", () => {
    expect(validateDigestDay("", false)).toBeUndefined();
  });
  it("is not saved when the digest is off", () => {
    expect(toSettings({ ...validValues(), weeklyDigest: false, digestDay: "mon" }).digestDay).toBeNull();
  });
});

describe("validateAll", () => {
  it("returns no errors for the defaults", () => {
    expect(validateAll(validValues())).toEqual({});
  });
  it("collects every invalid field", () => {
    const errors = validateAll({
      ...validValues(),
      displayName: " ",
      temperature: "abc",
      maxTokens: "100.5",
      systemPrompt: "a".repeat(2001),
      weeklyDigest: true,
      digestDay: "",
    });
    expect(Object.keys(errors)).toEqual(["displayName", "temperature", "maxTokens", "systemPrompt", "digestDay"]);
  });
});

describe("formValuesEqual", () => {
  it("compares every field", () => {
    expect(formValuesEqual(validValues(), validValues())).toBe(true);
    expect(formValuesEqual(validValues(), { ...validValues(), model: "smart" })).toBe(false);
  });
});

describe("parseStoredSettings", () => {
  const good: Settings = { ...DEFAULT_SETTINGS, displayName: "Ada", weeklyDigest: true, digestDay: "fri" };

  it("returns null for missing data", () => {
    expect(parseStoredSettings(null)).toBeNull();
  });
  it("returns null for corrupt JSON", () => {
    expect(parseStoredSettings("{not json")).toBeNull();
  });
  it("returns null for the wrong shape", () => {
    expect(parseStoredSettings("[]")).toBeNull();
    expect(parseStoredSettings("42")).toBeNull();
    expect(parseStoredSettings(JSON.stringify({ ...good, model: "turbo" }))).toBeNull();
    expect(parseStoredSettings(JSON.stringify({ ...good, maxTokens: "1024" }))).toBeNull();
  });
  it("returns null for values that break the form rules", () => {
    expect(parseStoredSettings(JSON.stringify({ ...good, temperature: 5 }))).toBeNull();
    expect(parseStoredSettings(JSON.stringify({ ...good, maxTokens: 100.5 }))).toBeNull();
    expect(parseStoredSettings(JSON.stringify({ ...good, displayName: " " }))).toBeNull();
    expect(parseStoredSettings(JSON.stringify({ ...good, digestDay: null }))).toBeNull();
  });
  it("returns valid saved settings", () => {
    expect(parseStoredSettings(JSON.stringify(good))).toEqual(good);
  });
});

describe("loadSettings / saveSettings", () => {
  it("round-trips through storage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(saveSettings(storage, DEFAULT_SETTINGS)).toBe(true);
    expect(store.has(STORAGE_KEY)).toBe(true);
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });
  it("never throws when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(loadSettings(broken)).toBeNull();
    expect(saveSettings(broken, DEFAULT_SETTINGS)).toBe(false);
  });
  it("handles missing storage", () => {
    expect(loadSettings(null)).toBeNull();
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
  });
});
