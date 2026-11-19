import { defineConfig } from "tsup";

// ソースは JS（JSDoc で型を書く）。リポジトリの lint はビルド前に動くので、
// リポジトリの中では src を直接読む（@repo/eslint-config の i18n-messages.js）。
// 公開用に dist へ ESM と CJS を出し、型は JSDoc から作る。
export default defineConfig({
  entry: ["src/index.js"],
  format: ["esm", "cjs"],
  dts: { entry: "src/index.js" },
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "node",
  outDir: "dist",
});
