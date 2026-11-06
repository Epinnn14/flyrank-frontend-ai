export type Settings = {
  displayName: string;
  email: string;
  website: string;
  bio: string;
  timezone: string;
  emailNotifications: boolean;
};

export type SettingsErrors = Partial<Record<keyof Settings, string>>;

export const BIO_MAX = 160;

export const TIMEZONES = ["UTC", "Asia/Jakarta", "Europe/London", "America/New_York", "America/Los_Angeles"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Returns the error message for one field, or undefined when it is valid. */
export function validateField<K extends keyof Settings>(field: K, value: Settings[K]): string | undefined {
  switch (field) {
    case "displayName": {
      const v = (value as string).trim();
      if (!v) return "Enter a display name.";
      if (v.length < 2) return "Display name must be at least 2 characters.";
      if (v.length > 50) return "Display name must be 50 characters or fewer.";
      return undefined;
    }
    case "email": {
      const v = (value as string).trim();
      if (!v) return "Enter an email address.";
      if (!EMAIL_RE.test(v)) return "Enter an email address like name@example.com.";
      return undefined;
    }
    case "website": {
      const v = (value as string).trim();
      if (v && !isHttpUrl(v)) return "Enter a full URL starting with http:// or https://.";
      return undefined;
    }
    case "bio": {
      if ((value as string).length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or fewer.`;
      return undefined;
    }
    case "timezone": {
      if (!TIMEZONES.includes(value as string)) return "Choose a time zone.";
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Validates every field. An empty object means the settings are valid. */
export function validateSettings(settings: Settings): SettingsErrors {
  const errors: SettingsErrors = {};
  for (const field of Object.keys(settings) as (keyof Settings)[]) {
    const message = validateField(field, settings[field]);
    if (message) errors[field] = message;
  }
  return errors;
}
