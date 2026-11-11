import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/examples/default.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  platform: "neutral",
  outDir: "dist",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
