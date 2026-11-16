import type { Page } from "@playwright/test";

import { expect, field, openDemo, previewValue, test } from "./helpers";

// zf.enum：uiType が badge の欄は、選択済みの値もバッジで出す
test.beforeEach(async ({ page }) => {
  await openDemo(page, "enumSelect", "zf.enum");
});

const FAVORITE = "一番好きな趣味(uiType: badge)";
const HOBBIES = "趣味(uiType: multipleEnumBadge)";

/** 欄の入れ物（ラベル・入力欄・バッジを含む）。入れ子の外側も一致するので、いちばん内側（最後）を採る */
const wrapperOf = (page: Page, label: string) =>
  page
    .locator(".mantine-InputWrapper-root")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();

const badgeOf = (page: Page, label: string) =>
  wrapperOf(page, label).getByTestId("badge-select-value");

test("badge の enum は、選択済みの値をバッジで出し、入力欄の文字は空", async ({
  page,
  pageErrors: _,
}) => {
  await expect(badgeOf(page, FAVORITE)).toHaveText("読書");
  await expect(field(page, FAVORITE)).toHaveValue("");
});

test("フォーカスすると文字入力になり、打ち込んだ文字で絞り込んで選び直せる", async ({
  page,
  pageErrors: _,
}) => {
  const input = field(page, FAVORITE);
  await input.click();
  await expect(badgeOf(page, FAVORITE)).toHaveCount(0);
  await expect(input).toHaveAttribute("placeholder", "読書");

  await input.pressSequentially("音");
  // 選択済みのラベルに足されない
  await expect(input).toHaveValue("音");
  await expect(page.getByRole("option")).toHaveText(["音楽"]);
  await page.getByRole("option", { name: "音楽", exact: true }).click();

  await expect(badgeOf(page, FAVORITE)).toHaveText("音楽");
  await expect(input).toHaveValue("");
  await expect
    .poll(async () => (await previewValue(page)).favoriteHobby)
    .toBe("music");
});

test("キーボードで選び直せる", async ({ page, pageErrors: _ }) => {
  const input = field(page, FAVORITE);
  await input.click();
  await input.pressSequentially("スポ");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(badgeOf(page, FAVORITE)).toHaveText("スポーツ");
  await expect
    .poll(async () => (await previewValue(page)).favoriteHobby)
    .toBe("sports");
});

test("クリアボタンで値を消せる", async ({ page, pageErrors: _ }) => {
  await wrapperOf(page, FAVORITE)
    .getByRole("button", { name: "クリア" })
    .click();
  await expect(badgeOf(page, FAVORITE)).toHaveCount(0);
  await expect
    .poll(async () => (await previewValue(page)).favoriteHobby)
    .toBeUndefined();
});

test("multipleEnumBadge は、選択済みもバッジで出し、× で外せる", async ({
  page,
  pageErrors: _,
}) => {
  const wrapper = wrapperOf(page, HOBBIES);
  await expect(wrapper.locator(".mantine-Badge-root")).toHaveText([
    "読書",
    "音楽",
  ]);
  await wrapper.getByRole("button", { name: "読書を外す" }).click();
  await expect(wrapper.locator(".mantine-Badge-root")).toHaveText(["音楽"]);
  await expect
    .poll(async () => (await previewValue(page)).hobbies)
    .toEqual(["music"]);
});
