import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/base.css";
import { Hero } from "./Hero";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Hero />
  </StrictMode>,
);
