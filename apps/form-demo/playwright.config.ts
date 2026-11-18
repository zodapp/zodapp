import { defineConfig, devices } from "@playwright/test";

/**
 * フォームのデモの E2E。DB もサーバーも使わないので、Vite だけを起動する。
 * spec は 1 つのデモページに 1 つ。手順はページを開いて試す手順と同じにする。
 *
 * ポートは E2E_PORT で変えられる（既定 3000）。別の作業コピーの dev サーバーを
 * 相手にテストしないよう、作業コピーごとに分けるときに使う
 */
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

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
    baseURL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
    video: "retain-on-failure",
    trace: "off",
  },
  webServer: {
    command: `pnpm exec vite --host --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
