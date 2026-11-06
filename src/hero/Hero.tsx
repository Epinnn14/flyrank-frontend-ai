import { useEffect, useRef, useState } from "react";
import fragment from "./aurora.frag?raw";
import { createRunner } from "./shaderRunner";
import "./Hero.css";

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export type Mode = { kind: "shader" } | { kind: "static"; why: string };

export function Hero() {
  const reduced = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>(reduced ? { kind: "static", why: "reduced motion" } : { kind: "shader" });

  useEffect(() => {
    if (reduced) {
      setMode({ kind: "static", why: "reduced motion" });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    let runner: ReturnType<typeof createRunner>;
    try {
      runner = createRunner(canvas, fragment);
    } catch (e) {
      setMode({ kind: "static", why: (e as Error).message.startsWith("WebGL2") ? "no WebGL 2" : "shader error" });
      return;
    }
    setMode({ kind: "shader" });

    // Only animate while someone can see it: tab visible AND hero on screen.
    let onScreen = true;
    const update = () => (document.hidden || !onScreen ? runner.stop() : runner.start());
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    if (heroRef.current) io.observe(heroRef.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      runner.destroy();
    };
  }, [reduced]);

  const base = import.meta.env.BASE_URL;
  return (
    <>
      <section ref={heroRef} className={`hero hero--${mode.kind}`} aria-labelledby="hero-title">
        {mode.kind === "shader" && <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />}
        {mode.kind === "static" && <canvas ref={canvasRef} hidden aria-hidden="true" />}
        <a className="hero__back" href={base}>← All assignments</a>
        <div className="hero__content">
          <p className="hero__eyebrow">Software engineer · backend, mobile &amp; applied AI</p>
          <h1 id="hero-title">Alessandro Kevin Aprilio</h1>
          <p className="hero__intro">I build the parts users never see, and lately the parts they do.</p>
          <div className="hero__actions">
            <a className="hero__cta hero__cta--primary" href={`${base}buttons/`}>See the button lab</a>
            <a className="hero__cta" href={`${base}viewer/`}>Open the 3D viewer</a>
          </div>
        </div>
        {mode.kind === "static" && (
          <p className="hero__note" role="note">
            Static gradient ({mode.why}): same palette, no animation.
          </p>
        )}
      </section>

      <main className="page hero-notes">
        <h2>How this hero works</h2>
        <p>
          A fragment shader (GLSL ES 3.0, plain WebGL2, no library) paints every pixel from three uniforms:{" "}
          <code>u_time</code>, <code>u_resolution</code> and <code>u_mouse</code>. Five layers of value noise (fBm) are
          domain-warped into curtains of light, shaped to hang from the top, coloured navy → teal → mint, and pulled
          gently toward your cursor. A scrim darkens the lower left so the headline stays readable, and a little film
          grain hides colour banding. The full source, commented block by block, is{" "}
          <a href="https://github.com/Epinnn14/flyrank-frontend-ai/blob/main/src/hero/aurora.frag">aurora.frag</a>.
        </p>
        <p>
          <strong>Perf and fallback in one line:</strong> device pixel ratio capped at 1.5, rendering stops when the
          tab is hidden or the hero scrolls away, and with reduced motion (or no WebGL 2) you get the same palette as a
          static CSS gradient.
        </p>
      </main>
    </>
  );
}
