import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/messages/index.ts",
    "src/index.ts",
    "src/baseComponents/index.ts",
    "src/baseComponents/*.tsx",
    "src/tableComponents/index.ts",
    "src/tableComponents/*.tsx",
    "src/reactiveComponents/index.ts",
    "src/reactiveComponents/*.tsx",
    "src/mediaResolvers/index.ts",
    "src/utils/index.ts",
    "!src/**/*.spec.tsx",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  // CJS でも共通部分を chunk にまとめる（入口ごとに React の context やレジストリが複製されないように）
  splitting: true,
  clean: true,
  target: "es2020",
  platform: "neutral",
  outDir: "dist",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
