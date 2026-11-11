/**
 * サーバーを 1 つのファイル（dist-server/main.mjs）にまとめる。AWS のコンテナ
 * （infra/server.Dockerfile）は、これだけを Node.js で動かす。
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/server/main.ts"],
  outfile: "dist-server/main.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // CommonJS の依存が require を使えるようにする
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  // ws の任意の高速化モジュール（入っていなければ使わない）
  external: ["bufferutil", "utf-8-validate"],
  logLevel: "info",
});
