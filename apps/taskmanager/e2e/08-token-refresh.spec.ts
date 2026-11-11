import { expect, test } from "@playwright/test";
import {
  AUTH_MAX_AGE_SECONDS,
  controlRealtimeSockets,
  login,
  realtimeCounts,
  setupWorkspace,
} from "./helpers";

test("トークンの入れ替え：認証の期限をまたいでも、つなぎ直さずに変更が届き続ける", async ({
  page,
  request,
}) => {
  // サーバーが認証の期限を縮めて起動していること（playwright.config.ts の webServer）
  const health = await (await request.get("/api/health")).json();
  expect(
    health.authMaxAgeSeconds,
    "pnpm dev を AUTH_MAX_AGE_SECONDS=20 で起動してください（起動中のサーバーがあると、それを使います）",
  ).toBe(AUTH_MAX_AGE_SECONDS);
  test.setTimeout((AUTH_MAX_AGE_SECONDS * 3 + 30) * 1000);

  const ws = await setupWorkspace();
  const scope = { workspaceId: ws.workspaceId, projectId: ws.projectId };
  await page.addInitScript(controlRealtimeSockets);
  await login(page, "bob@example.com");
  await page.goto(ws.tasksUrl);
  await expect(page.getByText("タスクがありません")).toBeVisible();

  // 期限の 2 回分をまたいで、ときどき alice が作る。bob の一覧に届き続ける
  const rounds = Math.ceil((AUTH_MAX_AGE_SECONDS * 2.5) / 10);
  for (let i = 1; i <= rounds; i++) {
    await page.waitForTimeout(10_000);
    const title = `期限をまたぐタスク ${i}`;
    await ws.alice.api.tasks.create(scope, { title });
    await expect(page.getByRole("row").filter({ hasText: title })).toBeVisible();
  }

  // 接続は 1 本のまま。トークンは auth メッセージで入れ替えた
  const counts = await realtimeCounts(page);
  expect(counts.opened).toBe(1);
  expect(counts.authSent).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
