import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const plugins: PluginOption[] = [react() as PluginOption];

export default defineConfig({
  // GitHub Pages（https://<owner>.github.io/zodapp/）に置くときは VITE_BASE=/zodapp/ でビルドする
  base: process.env.VITE_BASE ?? "/",
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "@mantine/core",
      "@mantine/hooks",
      "@mantine/dates",
      "@mantine/dropzone",
    ],
  },
  server: {
    host: true,
    port: 3000,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
