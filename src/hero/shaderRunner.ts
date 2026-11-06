/** A tiny WebGL2 runner for one fullscreen fragment shader: no library, about 120 lines. */

export const MAX_DPR = 1.5;

/** Device pixel ratio, capped: on a 3× phone a fullscreen shader would shade 9× the pixels for no visible gain. */
export function cappedDpr(dpr: number, max = MAX_DPR): number {
  return Math.max(1, Math.min(dpr || 1, max));
}

/** Frame-rate independent smoothing toward a target (exponential decay). rate = how fast, per second. */
export function smooth(current: number, target: number, dtSeconds: number, rate = 4): number {
  return current + (target - current) * (1 - Math.exp(-rate * dtSeconds));
}

const VERTEX = `#version 300 es
// One triangle that covers the whole screen (cheaper than two triangles: no diagonal seam to shade twice).
const vec2 pts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(pts[gl_VertexID], 0.0, 1.0); }`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`shader compile failed: ${log}`);
  }
  return s;
}

export type Runner = { start: () => void; stop: () => void; destroy: () => void };

/**
 * Creates the GL context and starts nothing yet. Throws if WebGL2 is missing or the shader doesn't compile, so the
 * caller can fall back to the static gradient.
 */
export function createRunner(canvas: HTMLCanvasElement, fragment: string): Runner {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) throw new Error("WebGL2 not available");

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`link failed: ${gl.getProgramInfoLog(program)}`);
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());

  const uTime = gl.getUniformLocation(program, "u_time");
  const uRes = gl.getUniformLocation(program, "u_resolution");
  const uMouse = gl.getUniformLocation(program, "u_mouse");

  let raf = 0;
  let running = false;
  let shaderTime = 0;                      // only advances while running: pausing freezes the picture, no jump on resume
  let last = 0;
  const mouse = { x: 0.7, y: 0.65, tx: 0.7, ty: 0.65 };

  function resize() {
    const dpr = cappedDpr(window.devicePixelRatio);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl!.viewport(0, 0, w, h);
    }
  }

  function frame(now: number) {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    shaderTime += dt;
    mouse.x = smooth(mouse.x, mouse.tx, dt);
    mouse.y = smooth(mouse.y, mouse.ty, dt);
    resize();
    gl!.uniform1f(uTime, shaderTime);
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform2f(uMouse, mouse.x, mouse.y);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    if (running) raf = requestAnimationFrame(frame);
  }

  function onPointer(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width;
    mouse.ty = 1 - (e.clientY - r.top) / r.height;   // GL's y goes up
  }
  window.addEventListener("pointermove", onPointer, { passive: true });

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
