import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/base.css";
import { ViewerPage } from "./ViewerPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="page page--wide">
      <a className="back" href={import.meta.env.BASE_URL}>← All assignments</a>
      <ViewerPage />
    </main>
  </StrictMode>,
);
