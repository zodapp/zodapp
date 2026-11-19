import type { Page } from "@playwright/test";

import { expect, field, openDemo, previewValue, test } from "./helpers";

// zf.record：キーの型で見た目が変わる（固定の欄・組を足して編集する欄）
test.beforeEach(async ({ page }) => {
  await openDemo(page, "recordEntries", "zf.record");
});

/** 値が value の入力欄 */
const inputWithValue = (page: Page, value: string) =>
  page.locator(`input[value="${value}"]`);

/** window.__formDemo の値を、ページの中で取り出す（Map は JSON にならないため） */
const readValue = <T>(page: Page, fn: string) =>
  page.evaluate(
    // eslint-disable-next-line no-new-func
    (body) => new Function("values", body)(window.__formDemo?.values) as T,
    fn,
  );

test("キーが enum の record は、選択肢の label を名前にした固定の欄で並び、入力するとそのキーに書く", async ({
  page,
  pageErrors: _,
}) => {
  // 「日本語」は言語の切り替えにもあるので、入力欄の役割で探す
  const text = (name: string) =>
    page.getByRole("textbox", { name, exact: true });
  await expect(text("日本語")).toHaveValue("こんにちは");
  await expect(text("英語")).toHaveValue("Hello");
  await expect(text("中国語")).toHaveValue("你好");
  // 固定の欄なので、キーの入力欄は出ない
  await expect(
    page.locator('input:not([type="radio"])[value="ja"]'),
  ).toHaveCount(0);

  await text("英語").fill("Hi");
  await expect
    .poll(async () => (await previewValue(page)).greeting)
    .toEqual({ ja: "こんにちは", en: "Hi", zh: "你好" });
});

test("キーが複数の値の literal の record も、キーごとの固定の欄で並ぶ", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "small")).toHaveValue("3");
  await expect(field(page, "medium")).toHaveValue("5");
  await expect(field(page, "large")).toHaveValue("0");
  await field(page, "large").fill("7");
  await expect
    .poll(async () => (await previewValue(page)).stock)
    .toEqual({ small: 3, medium: 5, large: 7 });
});

test("キーが enum の partialRecord は、組を足して編集する。enum に無いキーはエラーになる", async ({
  page,
  pageErrors: _,
}) => {
  await expect(inputWithValue(page, "alice")).toBeVisible();
  await expect(inputWithValue(page, "アリー")).toBeVisible();

  // あだ名の枠の ＋ で組を足し、キーと値を入れる
  const nicknames = page
    .locator(".mantine-InputWrapper-root")
    .filter({ hasText: "あだ名（キーが enum の partialRecord）" })
    .last();
  await nicknames.getByRole("button", { name: "追加" }).last().click();
  const keys = nicknames.getByLabel(/^キー/);
  const values = nicknames.getByLabel(/^値/);
  await expect(keys).toHaveCount(2);
  await keys.nth(1).fill("bob");
  await values.nth(1).fill("ボビー");
  await expect
    .poll(async () => (await previewValue(page)).nicknames)
    .toEqual({ alice: "アリー", bob: "ボビー" });

  // enum に無いキーにすると、その組は値から外れ、エラーが出る
  await keys.nth(1).fill("dave");
  await keys.nth(1).blur();
  await expect(
    nicknames.locator(".mantine-InputWrapper-error").first(),
  ).toBeVisible();
  await expect
    .poll(async () => (await previewValue(page)).nicknames)
    .toEqual({ alice: "アリー" });
});

test("Map は record の entries と同じ見た目で、書き換えると Map に書く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(inputWithValue(page, "daily")).toBeVisible();
  await expect(inputWithValue(page, "monthly")).toBeVisible();
  await inputWithValue(page, "monthly").fill("weekly");
  await expect
    .poll(() =>
      readValue<[string, number][]>(page, "return Array.from(values.quota)"),
    )
    .toEqual([
      ["daily", 10],
      ["weekly", 100],
    ]);
});
