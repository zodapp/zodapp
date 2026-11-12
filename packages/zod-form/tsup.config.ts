import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/def/index.ts",
    "src/externalKey/index.ts",
    "src/externalKey/types.ts",
    "src/file/index.ts",
    "src/file/types.ts",
    "src/resolverContext/index.ts",
    "src/resolverContext/types.ts",
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
