// Builds the default model for the 3D viewer: a flat-white cup on a saucer, made from lathe geometry,
// exported as GLB, then compressed with gltfpack (meshopt). Run: node scripts/make-model.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter reads Blobs with FileReader, which Node doesn't have. A 10-line stand-in is enough.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = "data:application/octet-stream;base64," + Buffer.from(b).toString("base64"); this.onloadend?.(); this.onload?.({ target: this }); }); }
};

const v = (x, y) => new THREE.Vector2(x, y);
const mat = (name, color, roughness, metalness = 0) =>
  Object.assign(new THREE.MeshStandardMaterial({ color, roughness, metalness }), { name });

const scene = new THREE.Scene();
const group = new THREE.Group();
group.name = "FlatWhite";

// Cup: a lathed profile (outside wall, rim, inside wall, inner floor).
const cupProfile = [v(0, 0), v(0.38, 0), v(0.42, 0.03), v(0.5, 0.25), v(0.6, 0.62), v(0.62, 0.66), v(0.58, 0.66), v(0.56, 0.6), v(0.47, 0.26), v(0.35, 0.08), v(0, 0.08)];
const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 64), mat("Cup", 0xf4efe6, 0.35));
cup.name = "Cup";
cup.position.y = 0.06;

// Coffee surface + latte-art ring.
const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.565, 64), mat("Coffee", 0xb9875a, 0.6));
coffee.name = "Coffee";
coffee.rotation.x = -Math.PI / 2;
coffee.position.y = 0.06 + 0.58;
const foam = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.3, 64), mat("Foam", 0xf6eadb, 0.8));
foam.name = "Foam";
foam.rotation.x = -Math.PI / 2;
foam.position.y = coffee.position.y + 0.002;

// Handle: a torus segment.
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 16, 48, Math.PI * 1.25), mat("Cup", 0xf4efe6, 0.35));
handle.name = "Handle";
handle.material = cup.material;
handle.position.set(0.62, 0.36, 0);
handle.rotation.z = -Math.PI * 0.62;

// Saucer.
const saucerProfile = [v(0, 0), v(0.75, 0), v(0.95, 0.07), v(1.0, 0.1), v(0.96, 0.11), v(0.75, 0.05), v(0.42, 0.045), v(0.4, 0.06), v(0, 0.06)];
const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerProfile, 64), mat("Saucer", 0x2f5d62, 0.45));
saucer.name = "Saucer";

group.add(saucer, cup, handle, coffee, foam);
scene.add(group);

const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
const raw = join(tmpdir(), "flat-white.raw.glb");
writeFileSync(raw, Buffer.from(glb));
execFileSync("npx", ["gltfpack", "-i", raw, "-o", "public/models/flat-white.glb", "-cc", "-kn", "-km"], { stdio: "inherit" });
console.log("raw", statSync(raw).size, "bytes → meshopt", statSync("public/models/flat-white.glb").size, "bytes");
