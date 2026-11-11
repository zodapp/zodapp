import { defineConfig, devices } from "@playwright/test";

/** AWS にデプロイしたものを試すときは、CloudFront の URL（e2e/helpers.ts の BASE_URL） */
const remoteBaseUrl = process.env.E2E_BASE_URL;

/**
 * ローカル（と Claude Code）で動かす E2E。
 * docker compose のインフラ（`pnpm infra:up`）は先に起動しておく。
 * メールの記録とアプリ（サーバー + Vite）は、起動していなければここで起動する。
 * E2E_BASE_URL を指定したときは、そこ（AWS）を試し、ローカルでは何も起動しない。
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 同じワークスペースを複数のブラウザで見るシナリオがあるので、直列に動かす
  workers: 1,
  fullyParallel: false,
  // CI（.github/workflows/e2e.yml）では、test.only の残りを失敗にし、失敗を PR の注釈に出す。
  // やり直しはしない（不安定なテストを隠さず、動画で原因を見る）
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remoteBaseUrl ?? "http://localhost:3000",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    video: "on",
    trace: "off",
  },
  webServer: remoteBaseUrl
    ? []
    : [
        {
          command: "pnpm mail",
          url: "http://localhost:2501/messages",
          reuseExistingServer: true,
        },
        {
          command: "pnpm dev",
          url: "http://localhost:3000/api/health",
          reuseExistingServer: true,
          timeout: 60_000,
          // 認証の期限を 20 秒に縮める（e2e/helpers.ts の AUTH_MAX_AGE_SECONDS）。
          // すべてのシナリオが、トークンの入れ替えをまたいで動くことも確かめる
          env: { AUTH_MAX_AGE_SECONDS: "20" },
        },
      ],
});
