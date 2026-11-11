import { defineConfig } from "vite";

// Relative base: the build works from a domain root, a GitHub Pages subpath, or any static host.
// Pages: the simulation, the live-trace example and the FAQ.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2020", rollupOptions: { input: { main: "index.html", example: "example.html", faq: "faq.html" } } },
});
