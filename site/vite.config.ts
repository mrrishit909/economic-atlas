/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/economic-atlas/",
  // no SPA fallback: a missing artifact is a real 404, as on GitHub Pages
  appType: "mpa",
  plugins: [react(), tailwindcss()],
  build: { target: "es2022", sourcemap: false },
  preview: { port: 4341, strictPort: true },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
