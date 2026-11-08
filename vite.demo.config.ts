import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The demo's pages: each gets its own index.html so GitHub Pages serves the path. */
const ROUTES = ["products", "inventory", "orders", "segments"];

// The demo site, built from demo/ and importing the package from its source.
// Locally it serves from "/"; on GitHub Pages from the repo's path.
export default defineConfig(({ command }) => ({
  root: "demo",
  base: command === "build" ? "/index-filter-bar/" : "/",
  plugins: [
    react(),
    {
      name: "page-per-route",
      closeBundle: () => {
        const out = fileURLToPath(new URL("demo-dist/", import.meta.url));
        for (const route of ROUTES) {
          mkdirSync(`${out}${route}`, { recursive: true });
          copyFileSync(`${out}index.html`, `${out}${route}/index.html`);
        }
        copyFileSync(`${out}index.html`, `${out}404.html`);
      },
    },
  ],
  resolve: {
    alias: {
      "@ljsstudios/index-filter-bar": fileURLToPath(new URL("src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  build: { outDir: "../demo-dist", emptyOutDir: true },
}));
