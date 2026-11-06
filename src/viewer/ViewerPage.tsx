import { lazy, Suspense, useState } from "react";
import { readEnv, startMode } from "./capability";
import "./Viewer.css";

// three.js + R3F + drei live in this chunk; the page paints (with the poster) before it is even requested.
const Viewer = lazy(() => import("./Viewer"));

const poster = `${import.meta.env.BASE_URL}viewer-poster.webp`;

function Poster({ reason, onLoad }: { reason?: string; onLoad?: () => void }) {
  return (
    <div className="viewer__poster card">
      <img src={poster} width={1200} height={800} alt="A flat-white cup on a teal saucer, rendered in 3D" />
      {reason && (
        <div className="viewer__poster-note">
          <p>{reason} Showing a still image instead.</p>
          <button type="button" className="viewer__button" onClick={onLoad}>
            Load the 3D viewer anyway
          </button>
        </div>
      )}
    </div>
  );
}

export function ViewerPage() {
  const [start] = useState(() => startMode(readEnv()));
  const [live, setLive] = useState(start.mode === "live");

  return (
    <div className="vpage">
      <header>
        <h1>Your first 3D experience</h1>
        <p className="muted">
          A GLB viewer with a small configurator. The default model is a 19 KB meshopt-compressed cup; drop your own
          .glb anywhere on the page.
        </p>
      </header>
      {live ? (
        <Suspense fallback={<Poster />}>
          <Viewer />
        </Suspense>
      ) : (
        <Poster reason={start.mode === "static" ? start.reason : undefined} onLoad={() => setLive(true)} />
      )}
    </div>
  );
}
