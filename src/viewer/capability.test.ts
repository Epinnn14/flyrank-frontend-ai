import { checkModelFile, startMode, type Env } from "./capability";

const ok: Env = { reducedMotion: false, saveData: false, deviceMemoryGb: 8, webgl2: true };

it("goes live on a capable device", () => {
  expect(startMode(ok)).toEqual({ mode: "live" });
  expect(startMode({ ...ok, deviceMemoryGb: undefined })).toEqual({ mode: "live" });   // Safari/Firefox don't report it
});

it.each([
  [{ webgl2: false }, "WebGL 2"],
  [{ reducedMotion: true }, "reduced motion"],
  [{ saveData: true }, "Data saver"],
  [{ deviceMemoryGb: 2 }, "low-memory"],
])("starts with the static poster when %o", (patch, reason) => {
  const m = startMode({ ...ok, ...patch });
  expect(m.mode).toBe("static");
  expect(m.mode === "static" && m.reason).toContain(reason);
});

it("accepts only .glb files up to 25 MB", () => {
  expect(checkModelFile({ name: "Chair.GLB", size: 3_000_000 })).toBeNull();
  expect(checkModelFile({ name: "chair.gltf", size: 1000 })).toMatch(/\.glb/);
  expect(checkModelFile({ name: "notes.txt", size: 10 })).toMatch(/\.glb/);
  expect(checkModelFile({ name: "huge.glb", size: 40 * 1048576 })).toMatch(/40\.0 MB/);
});
