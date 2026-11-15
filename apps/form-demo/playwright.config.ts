import { defineConfig, devices } from "@playwright/test";

/**
 * フォームのデモの E2E。DB もサーバーも使わないので、Vite だけを起動する。
 * spec は 1 つのデモページに 1 つ。手順はページを開いて試す手順と同じにする
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
    video: "retain-on-failure",
    trace: "off",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
