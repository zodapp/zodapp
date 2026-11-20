import type { Page } from "@playwright/test";

import {
  expect,
  field,
  formDemo,
  openDemo,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e 用のページ：入れ物の path を指定しない .refine() は、入れ物から出ると出て、直すと消える
test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-container-refine", "e2e：入れ物の refine");
});

const message = (page: Page, text: string) =>
  page.getByText(text, { exact: true });

/** 欄に値を入れて離れる（次の欄へ） */
const fillAndLeave = async (page: Page, label: string, value: string) => {
  const input = field(page, label);
  await input.fill(value);
  await input.press("Tab");
};

test("object：終了を開始より前にして離すとエラーが出て、直すと消える", async ({
  page,
  pageErrors: _,
}) => {
  await fillAndLeave(page, "終了", "0");
  await expect(message(page, "終了は開始より後にしてください")).toBeVisible();
  await fillAndLeave(page, "終了", "9");
  await expect(message(page, "終了は開始より後にしてください")).toHaveCount(0);
});

test("array：メンバーを重複させて離すとエラーが出て、直すと消える", async ({
  page,
  pageErrors: _,
}) => {
  const second = page.locator('input[value="Brown"]');
  await second.fill("Smith");
  await page.keyboard.press("Tab");
  await expect(message(page, "メンバーが重複しています")).toBeVisible();
  const again = page.locator('input[value="Smith"]').nth(1);
  await again.fill("Davis");
  await page.keyboard.press("Tab");
  await expect(message(page, "メンバーが重複しています")).toHaveCount(0);
});

test("record：配分の合計を 100 より大きくして離すとエラーが出て、直すと消える", async ({
  page,
  pageErrors: _,
}) => {
  await fillAndLeave(page, "B 社", "70");
  await expect(
    message(page, "配分の合計は 100 以下にしてください"),
  ).toBeVisible();
  await fillAndLeave(page, "B 社", "60");
  await expect(
    message(page, "配分の合計は 100 以下にしてください"),
  ).toHaveCount(0);
});

test("union：メールのドメインを変えて離すとエラーが出て、直すと消え、送信できる", async ({
  page,
  pageErrors: _,
}) => {
  await fillAndLeave(page, "メール", "info@other.test");
  await expect(
    message(page, "メールは @example.com にしてください"),
  ).toBeVisible();

  // 直す前の送信は止まる
  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);

  await fillAndLeave(page, "メール", "info@example.com");
  await expect(
    message(page, "メールは @example.com にしてください"),
  ).toHaveCount(0);
  await submit(page);
  await waitSubmitSettled(page, 2);
  expect((await formDemo(page)).submitted.count).toBe(1);
});
