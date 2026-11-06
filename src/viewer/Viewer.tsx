/**
 * The 3D part of the viewer page. Everything here (three.js, R3F, drei) is in its own lazy chunk: the page itself
 * paints first, with a static poster, and only then downloads this.
 */
import { Bounds, ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { checkModelFile } from "./capability";
import "./Viewer.css";

export type Look = { color: string; metalness: number; roughness: number; wireframe: boolean };
type MaterialInfo = { key: string; label: string; look: Look };
type ModelInfo = { materials: MaterialInfo[]; parts: string[]; triangles: number };
type Preset = "studio" | "sunset" | "night";

const DEFAULT_URL = `${import.meta.env.BASE_URL}models/flat-white.glb`;
const DEFAULT_NAME = "flat-white.glb (19 KB, meshopt)";

/* ------------------------------------------------------------------ the model */

/** gltfpack (and many exporters) put the mesh under a named node and give the mesh itself a generic name
 * ("mesh_3"). The part a person recognises is the nearest named node. */
export function partName(o: THREE.Object3D, root: THREE.Object3D): string {
  let cur: THREE.Object3D | null = o;
  while (cur && cur !== root) {
    if (cur.name && !/^mesh_\d+$/.test(cur.name)) return cur.name;
    cur = cur.parent;
  }
  return o.name || "Part";
}

function Model({
  url,
  looks,
  hidden,
  onInfo,
}: {
  url: string;
  looks: Record<string, Look>;
  hidden: Set<string>;
  onInfo: (info: ModelInfo) => void;
}) {
  // Draco + meshopt decoders are wired in, so compressed files from Blender or gltfpack load as-is.
  const gltf = useGLTF(url, true, true);
  const invalidate = useThree((s) => s.invalidate);

  // A private copy: cloned scene AND cloned materials, so edits never leak into the loader cache.
  const { root, materials } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        const key = m.uuid;
        if (!materials.has(key)) {
          const copy =
            m instanceof THREE.MeshStandardMaterial ? m.clone() : new THREE.MeshStandardMaterial({ color: 0xcccccc });
          copy.name = m.name;
          materials.set(key, copy);
        }
        return materials.get(key)!;
      });
      mesh.material = Array.isArray(mesh.material) ? list : list[0];
    });
    // Normalise: the largest side becomes 2 units, centred on x/z, standing on y = 0.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2 / Math.max(size.x, size.y, size.z, 1e-6);
    const centre = box.getCenter(new THREE.Vector3());
    root.scale.setScalar(scale);
    root.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
    return { root, materials };
  }, [gltf]);

  // Report what the configurator can edit.
  useEffect(() => {
    let triangles = 0;
    const parts: string[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const name = partName(mesh, root);
      if (!parts.includes(name)) parts.push(name);
    });
    onInfo({
      triangles: Math.round(triangles),
      parts,
      materials: [...materials.entries()].map(([key, m], i) => ({
        key,
        label: m.name || `Material ${i + 1}`,
        look: { color: `#${m.color.getHexString()}`, metalness: m.metalness, roughness: m.roughness, wireframe: m.wireframe },
      })),
    });
  }, [root, materials, onInfo]);

  // Apply configurator edits, then ask for one new frame (the canvas renders on demand).
  useEffect(() => {
    for (const [key, look] of Object.entries(looks)) {
      const m = materials.get(key);
      if (!m) continue;
      m.color.set(look.color);
      m.metalness = look.metalness;
      m.roughness = look.roughness;
      m.wireframe = look.wireframe;
    }
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.visible = !hidden.has(partName(o, root));
    });
    invalidate();
  }, [looks, hidden, materials, root, invalidate]);

  return <primitive object={root} />;
}

useGLTF.preload(DEFAULT_URL, true, true);

/* ------------------------------------------------------------------ lighting */

const PRESETS: Record<Preset, { label: string; lights: { color: string; intensity: number; position: [number, number, number]; scale: [number, number, number] }[] }> = {
  studio: {
    label: "Studio",
    lights: [
      { color: "#ffffff", intensity: 3, position: [0, 4, -3], scale: [8, 3, 1] },
      { color: "#ffffff", intensity: 1.5, position: [-4, 1, 2], scale: [3, 6, 1] },
      { color: "#ffffff", intensity: 1.2, position: [4, 1, 2], scale: [3, 6, 1] },
    ],
  },
  sunset: {
    label: "Sunset",
    lights: [
      { color: "#ff9a5a", intensity: 4, position: [-4, 1.5, -1], scale: [6, 3, 1] },
      { color: "#8a5cff", intensity: 1.6, position: [4, 2, 2], scale: [4, 4, 1] },
      { color: "#ffd9a8", intensity: 1, position: [0, 5, 0], scale: [6, 6, 1] },
    ],
  },
  night: {
    label: "Night",
    lights: [
      { color: "#5aa9ff", intensity: 2.5, position: [3, 2, -3], scale: [3, 6, 1] },
      { color: "#2dd4bf", intensity: 1.2, position: [-3, 1, 3], scale: [2, 4, 1] },
      { color: "#20304a", intensity: 1, position: [0, 5, 0], scale: [8, 8, 1] },
    ],
  },
};

function Lighting({ preset }: { preset: Preset }) {
  // A procedural environment (no HDR download), rendered once per preset: frames={1}.
  return (
    <Environment key={preset} resolution={128} frames={1}>
      {PRESETS[preset].lights.map((l, i) => (
        <Lightformer key={i} form="rect" color={l.color} intensity={l.intensity} position={l.position} scale={l.scale} target={[0, 0.8, 0]} />
      ))}
    </Environment>
  );
}

/* ------------------------------------------------------------------ errors */

class ModelBoundary extends Component<{ onError: (msg: string) => void; children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(`Couldn't read that model (${e.message.slice(0, 80)}).`);
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ------------------------------------------------------------------ the viewer */

export default function Viewer() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [fileName, setFileName] = useState(DEFAULT_NAME);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [looks, setLooks] = useState<Record<string, Look>>({});
  const [selected, setSelected] = useState<string>("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [preset, setPreset] = useState<Preset>("studio");
  const [spin, setSpin] = useState(1.2);
  const [message, setMessage] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const onInfo = useMemo(
    () => (i: ModelInfo) => {
      setInfo(i);
      setLooks(Object.fromEntries(i.materials.map((m) => [m.key, m.look])));
      setSelected(i.materials[0]?.key ?? "");
      setHidden(new Set());
      setMessage(`Loaded ${i.parts.length || "the"} part${i.parts.length === 1 ? "" : "s"}, ${i.materials.length} material${i.materials.length === 1 ? "" : "s"}, ${i.triangles.toLocaleString()} triangles.`);
    },
    [],
  );

  function open(file: File) {
    const problem = checkModelFile(file);
    if (problem) {
      setMessage(problem);
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setInfo(null);
    setMessage(`Loading ${file.name}…`);
    setFileName(`${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
    setUrl(objectUrl.current);
  }

  function resetModel() {
    setInfo(null);
    setUrl(DEFAULT_URL);
    setFileName(DEFAULT_NAME);
  }

  const look = selected ? looks[selected] : undefined;
  const setLook = (patch: Partial<Look>) => selected && setLooks((l) => ({ ...l, [selected]: { ...l[selected], ...patch } }));

  return (
    <div
      className={`viewer${dragging ? " viewer--drop" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) open(f);
      }}
    >
      <div className="viewer__stage" aria-label={`3D view of ${fileName}. Drag to rotate, pinch or scroll to zoom.`} role="img">
        <Canvas
          frameloop={spin > 0 ? "always" : "demand"}
          dpr={[1, 1.75]}
          camera={{ position: [2.6, 2, 2.6], fov: 38 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <Lighting preset={preset} />
          <ModelBoundary onError={(m) => { setMessage(m); resetModel(); }} resetKey={url}>
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.3}>
                <Model url={url} looks={looks} hidden={hidden} onInfo={onInfo} />
              </Bounds>
            </Suspense>
          </ModelBoundary>
          <ContactShadows key={`${url}-${[...hidden].join()}`} position={[0, 0, 0]} opacity={0.45} blur={2.4} scale={6} far={2.5} frames={1} />
          <OrbitControls makeDefault enableDamping autoRotate={spin > 0} autoRotateSpeed={spin} minDistance={1.2} maxDistance={9} target={[0, 0.8, 0]} />
        </Canvas>
        {!info && <p className="viewer__loading">Loading model…</p>}
        <p className="viewer__hint muted">Drag to rotate · pinch/scroll to zoom · drop any .glb here</p>
      </div>

      <form className="viewer__panel card" onSubmit={(e) => e.preventDefault()} aria-label="Configurator">
        <div className="viewer__file">
          <span className="muted">Model</span>
          <strong>{fileName}</strong>
          <div className="viewer__file-actions">
            <label className="viewer__button">
              Open .glb…
              <input type="file" accept=".glb,model/gltf-binary" className="visually-hidden" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
            </label>
            {url !== DEFAULT_URL && (
              <button type="button" className="viewer__button" onClick={resetModel}>
                Back to the cup
              </button>
            )}
          </div>
        </div>

        {info && info.materials.length > 0 && look && (
          <fieldset>
            <legend>Material</legend>
            <label htmlFor="material-select">Material to edit</label>
            <select id="material-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {info.materials.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <label className="viewer__row">
              Colour <input type="color" value={look.color} onChange={(e) => setLook({ color: e.target.value })} />
            </label>
            <label>
              <span className="viewer__label">Metalness <output>{look.metalness.toFixed(2)}</output></span>
              <input type="range" min={0} max={1} step={0.01} value={look.metalness} onChange={(e) => setLook({ metalness: Number(e.target.value) })} />
            </label>
            <label>
              <span className="viewer__label">Roughness <output>{look.roughness.toFixed(2)}</output></span>
              <input type="range" min={0} max={1} step={0.01} value={look.roughness} onChange={(e) => setLook({ roughness: Number(e.target.value) })} />
            </label>
            <label className="viewer__row">
              <input type="checkbox" checked={look.wireframe} onChange={(e) => setLook({ wireframe: e.target.checked })} /> Wireframe
            </label>
          </fieldset>
        )}

        {info && info.parts.length > 1 && (
          <fieldset>
            <legend>Parts</legend>
            {info.parts.map((p) => (
              <label key={p} className="viewer__row">
                <input
                  type="checkbox"
                  checked={!hidden.has(p)}
                  onChange={(e) =>
                    setHidden((h) => {
                      const n = new Set(h);
                      if (e.target.checked) n.delete(p);
                      else n.add(p);
                      return n;
                    })
                  }
                />
                {p}
              </label>
            ))}
          </fieldset>
        )}

        <fieldset>
          <legend>Lighting</legend>
          <div className="viewer__presets">
            {(Object.keys(PRESETS) as Preset[]).map((p) => (
              <label key={p} className="viewer__row">
                <input type="radio" name="preset" value={p} checked={preset === p} onChange={() => setPreset(p)} />
                {PRESETS[p].label}
              </label>
            ))}
          </div>
          <label>
            <span className="viewer__label">Auto-rotate <output>{spin === 0 ? "off" : spin.toFixed(1)}</output></span>
            <input type="range" min={0} max={4} step={0.1} value={spin} onChange={(e) => setSpin(Number(e.target.value))} />
          </label>
        </fieldset>

        <p role="status" className="viewer__status muted">{message}</p>
      </form>
    </div>
  );
}
