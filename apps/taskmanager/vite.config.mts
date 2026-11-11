import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const serverPort = process.env.PORT ?? "4000";

export default defineConfig({
  // サーバーと同じ認証の期限（E2E でトークンの入れ替えを確かめるとき）を、画面にも渡す
  define: {
    "import.meta.env.VITE_AUTH_MAX_AGE_SECONDS": JSON.stringify(
      process.env.AUTH_MAX_AGE_SECONDS ?? "",
    ),
  },
  plugins: [react() as PluginOption],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/web"),
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
    strictPort: true,
    // Playwright の結果を書いても、画面を読み直さない
    watch: { ignored: ["**/test-results/**", "**/playwright-report/**"] },
    proxy: {
      // HTTP の API と、Realtime Gateway の WebSocket をサーバーへ
      "/api": { target: `http://localhost:${serverPort}`, ws: true },
    },
  },
});
