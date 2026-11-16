import type { Page } from "@playwright/test";

import { expect, openDemo, previewValue, test } from "./helpers";

// z.lazy：discriminator のない union を入れ子にしたページ
test.beforeEach(async ({ page }) => {
  await openDemo(page, "recursiveSchema", "z.lazy");
});

/** 腕の選択の欄（外側から順に並ぶ） */
const selectors = (page: Page) => page.getByRole("combobox");

const chooseArm = async (page: Page, index: number, option: string) => {
  await selectors(page).nth(index).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test("入れ子の腕を数値・オブジェクトに切り替えられる", async ({
  page,
  pageErrors: _,
}) => {
  await expect(selectors(page)).toHaveCount(3);
  await expect(selectors(page).nth(2)).toHaveValue("文字列");

  // 腕を選んだ直後は値が空でも、選んだ腕の欄を出す
  await chooseArm(page, 2, "数値");
  await expect(selectors(page).nth(2)).toHaveValue("数値");
  await page.getByRole("textbox").fill("42");
  await expect
    .poll(async () => (await previewValue(page)).anyValue)
    .toEqual({ value: { value: 42 } });

  await chooseArm(page, 2, "オブジェクト");
  await expect(selectors(page).nth(2)).toHaveValue("オブジェクト");
  await expect(selectors(page)).toHaveCount(4);
});
