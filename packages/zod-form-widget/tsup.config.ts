import { defineConfig } from "tsup";
import { buildCss } from "./scripts/build-css.mjs";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/table/index.ts",
    "src/tabular/index.ts",
    "src/form/index.ts",
    "src/feedback/index.ts",
    "src/i18n/ja.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  // CJS でも共通部分を chunk にまとめる（入口ごとに React の context などが複製されないように）
  splitting: true,
  clean: true,
  target: "es2020",
  platform: "neutral",
  outDir: "dist",
  // AutoTable.module.css などの CSS Modules を esbuild で変換する。
  // CSS は JS から import せず、onSuccess で dist/styles.css にまとめる（利用者が自分で import する）
  loader: { ".css": "local-css" },
  onSuccess: async () => {
    buildCss("dist");
  },
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
