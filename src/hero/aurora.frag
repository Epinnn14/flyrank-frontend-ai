#version 300 es
// Aurora hero: a slow, domain-warped noise field shaped into curtains of light, in my portfolio's palette
// (navy, teal, mint, a touch of violet), that leans gently toward the cursor. Comments are mine, block by block.
precision highp float;

uniform float u_time;        // seconds since start (frozen while the tab is hidden or the hero is off-screen)
uniform vec2  u_resolution;  // canvas size in device pixels
uniform vec2  u_mouse;       // cursor in 0..1 (0,0 = bottom-left), already smoothed on the CPU

out vec4 outColor;

// --- 1. Randomness. A cheap hash: any 2D point → a repeatable pseudo-random number in 0..1.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// --- 2. Value noise. Random values at grid corners, blended with a smoothstep curve so there are no hard edges.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// --- 3. fBm ("fractal Brownian motion"). 5 layers of noise, each twice as detailed and half as strong,
//        rotated a little every layer so the grid never shows. This is what makes it look organic.
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return value;
}

void main() {
  // --- 4. Coordinates. uv is 0..1 across the screen (for the scrim); p is centred and aspect-correct
  //        (1 unit = screen height), so the pattern never stretches on wide or tall screens.
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec2 mouse = (u_mouse - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * 0.06;                      // slow: the hero should breathe, not dance

  // --- 5. Lean toward the cursor. Every point is pulled a little toward the mouse; the pull fades with distance
  //        (a gaussian), so only the area near the cursor bends.
  vec2 toMouse = mouse - p;
  p += toMouse * 0.18 * exp(-dot(toMouse, toMouse) * 2.0);

  // --- 6. Domain warping. Instead of fbm(p) we use fbm(p + fbm(...)): noise that distorts noise. q drifts in
  //        opposite directions over time, which gives the flowing, folded look of an aurora.
  //        The field is sampled stretched vertically (y * 0.35), which turns blobs into tall streaks: curtains.
  vec2 s = vec2(p.x * 1.5, p.y * 0.35);
  vec2 q = vec2(fbm(s * 1.6 + vec2(0.0, t)), fbm(s * 1.6 + vec2(5.2, -t)));
  float field = fbm(s * 1.2 + 2.2 * q + vec2(t * 0.7, 0.0));

  // --- 7. Curtains. Keep only the bright parts of the field, and fade them out toward the bottom with a wavy
  //        horizon so the light hangs from the top like real aurora.
  float curtain = smoothstep(0.24, 0.58, field) * smoothstep(-0.6, 0.35, p.y + 0.25 * sin(p.x * 2.0 + t * 3.0));

  // --- 8. Palette: night navy → teal → mint at the brightest, plus violet where the warp is strongest.
  vec3 navy   = vec3(0.035, 0.055, 0.110);
  vec3 teal   = vec3(0.090, 0.700, 0.640);
  vec3 mint   = vec3(0.620, 0.980, 0.860);
  vec3 violet = vec3(0.450, 0.330, 0.950);
  vec3 col = mix(navy, teal, curtain);
  col = mix(col, mint, pow(curtain, 3.0) * 0.8);
  col += violet * 0.35 * smoothstep(0.55, 1.0, q.x) * (1.0 - uv.y);

  // --- 9. Readability. A soft vignette, then a scrim that darkens the lower-left area where the headline sits:
  //        contrast is part of the design, not an afterthought.
  col *= 0.75 + 0.25 * smoothstep(1.2, 0.2, length(p));
  col *= mix(0.42, 1.0, smoothstep(0.0, 0.75, uv.x * 0.55 + uv.y * 0.8));

  // --- 10. Film grain. A tiny amount of per-pixel noise that changes every frame: it hides colour banding in the
  //         smooth gradients and makes the image feel less "digital".
  col += (hash(gl_FragCoord.xy + fract(u_time) * 97.0) - 0.5) * 0.035;

  outColor = vec4(col, 1.0);
}
