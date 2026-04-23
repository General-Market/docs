import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "app",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app/src"),
      "@remotion-mc": path.resolve(__dirname, "remotion"),
    },
  },
  server: {
    port: 5181,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:5182",
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
