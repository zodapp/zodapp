import { expect, test } from "@playwright/test";
import { DEV_PASSWORD, unique, waitForConfirmationCode } from "./helpers";

test("サインアップ：メールの確認コードで確認して、ログインする", async ({ page }) => {
  const email = `${unique("new")}@example.com`;

  await page.goto("/taskManager/login");
  await page.getByText("新規登録").click();
  await page.getByLabel("表示名").fill("New User");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "登録する" }).click();

  // magnito が送った確認メールを、メールの記録から読む
  await expect(page.getByText(`${email} 宛に確認コードを送信しました`)).toBeVisible();
  const code = await waitForConfirmationCode(email);
  await page.getByLabel("確認コード").fill(code);
  await page.getByRole("button", { name: "確認してログイン" }).click();

  await expect(page).toHaveURL(/\/taskManager\/workspaces/);
  await expect(page.getByRole("heading", { name: "ワークスペース一覧" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});
