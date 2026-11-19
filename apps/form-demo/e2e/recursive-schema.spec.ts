import type { Page } from "@playwright/test";

import { expect, field, openDemo, previewValue, test } from "./helpers";

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
  // 任意のデータの欄は、組織の欄より前にある
  const numberInput = page.getByRole("textbox").first();
  await expect(numberInput).toHaveValue("");
  await numberInput.fill("42");
  await expect
    .poll(async () => (await previewValue(page)).anyValue)
    .toEqual({ value: { value: 42 } });

  await chooseArm(page, 2, "オブジェクト");
  await expect(selectors(page).nth(2)).toHaveValue("オブジェクト");
  await expect(selectors(page)).toHaveCount(4);
});

test("関数で深さを決めた optional なしの再帰（部 → 課 → 係）は、上限の注記なしで全部描く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "部の名前")).toHaveValue("営業部");
  await expect(field(page, "課の名前")).toHaveValue("第一課");
  await expect(field(page, "係の名前")).toHaveValue("法人係");
  await expect(page.locator("[data-zod-form-unsupported]")).toHaveCount(0);

  await field(page, "係の名前").fill("個人係");
  await expect
    .poll(async () => (await previewValue(page)).organization)
    .toEqual({
      name: "営業部",
      child: { name: "第一課", child: { name: "個人係" } },
    });
});
