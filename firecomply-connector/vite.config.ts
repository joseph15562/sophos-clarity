import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  root: "src/renderer",
  plugins: [
    react(),
    {
      name: "electron-html-fix",
      transformIndexHtml(html) {
        return html
          .replace(/\s+crossorigin/g, "")
          .replace(/ type="module"/g, "")
          .replace(/<script src=/g, "<script defer src=");
      },
    },
  ],
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
