import { defineConfig } from "vite";

// Relative base: the build works from a domain root, a GitHub Pages subpath, or any static host.
// Two pages: the simulation and the live-trace example.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2020", rollupOptions: { input: { main: "index.html", example: "example.html" } } },
});
