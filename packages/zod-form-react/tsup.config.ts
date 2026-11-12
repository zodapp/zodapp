import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/common/index.ts",
    "src/media/index.ts",
    "src/media/types.ts",
    "src/mediaResolvers/index.ts",
    "src/def/index.ts",
    "src/utils/dateConverter.ts",
    "src/utils/externalKey.ts",
  ],
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
