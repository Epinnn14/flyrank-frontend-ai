/// <reference types="vitest/config" />
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One Vite app, one page per assignment. GitHub Pages serves it under /<repo>/, so BASE_PATH is set in CI.
const pages = ["index", "settings", "buttons", "viewer", "hero"];

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((p) => [p, resolve(import.meta.dirname, p === "index" ? "index.html" : `${p}/index.html`)]),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    css: false,
  },
});
