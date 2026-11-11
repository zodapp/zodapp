import { expect, test } from "@playwright/test";
import {
  controlRealtimeSockets,
  login,
  setupWorkspace,
  type RealtimeControl,
} from "./helpers";

test("再接続：切れている間の変更も、つながり直すと一覧に出る", async ({ page }) => {
  const ws = await setupWorkspace();
  const scope = { workspaceId: ws.workspaceId, projectId: ws.projectId };
  await ws.alice.api.tasks.create(scope, { title: "切断の前" });

  await page.addInitScript(controlRealtimeSockets);
  await login(page, "bob@example.com");
  await page.goto(ws.tasksUrl);
  await expect(page.getByRole("row").filter({ hasText: "切断の前" })).toBeVisible();
  const openedBefore = await page.evaluate(
    () => (window as unknown as { __realtime: RealtimeControl }).__realtime.control.opened,
  );

  // 接続を切り、つながり直せないようにしておく
  await page.evaluate(() =>
    (window as unknown as { __realtime: RealtimeControl }).__realtime.disconnect(),
  );

  // 切れている間に alice が作ったタスク。bob には変更の通知が届かない
  await ws.alice.api.tasks.create(scope, { title: "切断中に作った" });
  await page.waitForTimeout(1500);
  await expect(page.getByRole("row").filter({ hasText: "切断中に作った" })).toHaveCount(0);

  // つながり直せるようにすると、購読からやり直して一覧を読み直す
  await page.evaluate(() =>
    (window as unknown as { __realtime: RealtimeControl }).__realtime.allow(),
  );
  await expect(page.getByRole("row").filter({ hasText: "切断中に作った" })).toBeVisible({
    timeout: 30_000,
  });
  const openedAfter = await page.evaluate(
    () => (window as unknown as { __realtime: RealtimeControl }).__realtime.control.opened,
  );
  expect(openedAfter).toBeGreaterThan(openedBefore);
});
