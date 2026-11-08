import { cpSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The package: one ESM bundle and one stylesheet. React, React DOM and
// dnd-kit stay the app's; the locale files are copied as they are.
export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-locales",
      closeBundle: () => cpSync("src/locales", "dist/locales", { recursive: true }),
    },
  ],
  css: {
    modules: {
      // Prefixed so the bar's classes never meet an app's.
      generateScopedName: "ifb_[local]_[hash:base64:5]",
    },
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "style",
    },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@dnd-kit\//],
    },
  },
});
