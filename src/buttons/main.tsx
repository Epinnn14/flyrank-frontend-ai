import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="page">
      <a className="back" href={import.meta.env.BASE_URL}>← All assignments</a>
      <p>Coming soon.</p>
    </main>
  </StrictMode>,
);
