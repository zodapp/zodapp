import type { Page } from "@playwright/test";

import { choose, expect, field, openDemo, previewValue, test } from "./helpers";

// zf.union：discriminator のない union。腕を選ぶと、その腕の欄が出る
test.beforeEach(async ({ page }) => {
  await openDemo(page, "union", "zf.union");
});

const SELECTOR = "連絡先タイプ";

/** 「電話番号」の欄（前方一致だと「電話番号タイプ」も当たるので、完全一致で探す） */
const phoneInput = (page: Page) =>
  page.getByRole("textbox", { name: "電話番号", exact: true });

test("初期値のメールアドレスの腕を出す", async ({ page, pageErrors: _ }) => {
  await expect(field(page, SELECTOR)).toHaveValue("メールアドレス(文字列)");
  await expect(page.locator('input[value="user@example.com"]')).toBeVisible();
});

test("電話を選ぶと電話の欄が出て、入力の途中でも腕の表示が保たれる", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, SELECTOR, "電話");

  await expect(field(page, SELECTOR)).toHaveValue("電話");
  await expect(field(page, "電話番号タイプ")).toBeVisible();
  await expect(phoneInput(page)).toBeVisible();
  expect((await previewValue(page)).contact).toEqual({ type: "phone" });

  await choose(page, "電話番号タイプ", "携帯電話");
  await phoneInput(page).fill("090");

  await expect
    .poll(async () => (await previewValue(page)).contact)
    .toEqual({ type: "phone", phoneType: "mobile", phone: "090" });
  await expect(field(page, SELECTOR)).toHaveValue("電話");
});

test("住所に切り替え、メールアドレスに戻せる", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, SELECTOR, "電話");
  await expect(phoneInput(page)).toBeVisible();

  await choose(page, SELECTOR, "住所");
  await expect(field(page, SELECTOR)).toHaveValue("住所");
  await page
    .getByRole("textbox", { name: "住所", exact: true })
    .fill("東京都千代田区");
  await expect
    .poll(async () => (await previewValue(page)).contact)
    .toEqual({ type: "address", address: "東京都千代田区" });
  await expect(phoneInput(page)).toHaveCount(0);

  await choose(page, SELECTOR, "メールアドレス(文字列)");
  await expect(field(page, SELECTOR)).toHaveValue("メールアドレス(文字列)");
  await expect(
    page.getByRole("textbox", { name: "住所", exact: true }),
  ).toHaveCount(0);
});
