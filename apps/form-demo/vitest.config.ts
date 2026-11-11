import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{spec,test}.{ts,tsx}", "tests/**/*.{spec,test}.{ts,tsx}"],
    exclude: ["dist/**", "**/dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "*.config.ts",
        "*.config.js",
        "**/*.spec.ts",
        "**/*.test.ts",
      ],
    },
  },
});
