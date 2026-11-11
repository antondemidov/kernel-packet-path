import { defineConfig } from "vite";

// Relative base: the build works from a domain root, a GitHub Pages subpath, or any static host.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2020" },
});
