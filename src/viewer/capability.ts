/** Decide, before downloading any 3D code, whether to start with the static poster instead of the live scene. */
export type Env = {
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemoryGb: number | undefined;
  webgl2: boolean;
};

export type StartMode = { mode: "live" } | { mode: "static"; reason: string };

export function startMode(env: Env): StartMode {
  if (!env.webgl2) return { mode: "static", reason: "This browser can't run WebGL 2." };
  if (env.reducedMotion) return { mode: "static", reason: "Your device asks for reduced motion." };
  if (env.saveData) return { mode: "static", reason: "Data saver is on." };
  if (env.deviceMemoryGb !== undefined && env.deviceMemoryGb <= 2) {
    return { mode: "static", reason: "This looks like a low-memory device." };
  }
  return { mode: "live" };
}

export function readEnv(): Env {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  let webgl2 = false;
  try {
    webgl2 = Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    webgl2 = false;
  }
  return {
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemoryGb: nav.deviceMemory,
    webgl2,
  };
}

/** Only .glb files under 25 MB are accepted by drag-and-drop. */
export const MAX_MODEL_BYTES = 25 * 1024 * 1024;

export function checkModelFile(file: { name: string; size: number }): string | null {
  if (!/\.glb$/i.test(file.name)) return "Drop a .glb file (binary glTF).";
  if (file.size > MAX_MODEL_BYTES) return `That file is ${(file.size / 1048576).toFixed(1)} MB; the limit is 25 MB.`;
  return null;
}
