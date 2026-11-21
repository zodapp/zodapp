import type { Page } from "@playwright/test";

import {
  expect,
  field,
  formDemo,
  openDemo,
  previewValue,
  submit,
  test,
} from "./helpers";

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

/** label の文字で、その欄の枠を探す */
const section = (page: Page, label: string) =>
  page
    .locator(".mantine-InputWrapper-root, fieldset")
    .filter({ hasText: label })
    .last();

/** 枠の中の行の名前（州）を、並んでいる順に */
// entries の行は role="group" で、行の上の名前が付く（枠は fieldset）
const rowNames = (box: ReturnType<typeof section>) =>
  box
    .locator('[role="group"][aria-labelledby]')
    .evaluateAll((groups) =>
      groups
        .map(
          (group) =>
            document.getElementById(group.getAttribute("aria-labelledby")!)
              ?.textContent ?? "",
        )
        .filter((text) => /^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(text)),
    );

/** 枠のいちばん下の選択で、文字で絞り込んでキーを足す */
const addKey = async (
  page: Page,
  box: ReturnType<typeof section>,
  typed: string,
  name: string,
) => {
  const select = box.getByRole("combobox", { name: "キーを追加" });
  await select.click();
  await select.fill(typed);
  await page.getByRole("option", { name, exact: true }).click();
};

test("キーが enum の partialRecord（既定）は、候補のキーを label で全部並べ、空にするとキーごと消える", async ({
  page,
  pageErrors: _,
}) => {
  const text = (name: string) =>
    page.getByRole("textbox", { name, exact: true });
  await expect(text("アリス")).toHaveValue("Ally");
  await expect(text("ボブ")).toHaveValue("");
  await expect(text("キャロル")).toHaveValue("");
  // キーを打つ欄は出ない
  await expect(
    section(page, "あだ名（キーが enum の partialRecord）").getByRole(
      "textbox",
      { name: /^キー/ },
    ),
  ).toHaveCount(0);

  await text("ボブ").fill("ボビー");
  await expect
    .poll(async () => (await previewValue(page)).nicknames)
    .toEqual({ alice: "Ally", bob: "ボビー" });

  // 空にすると、undefined を入れずにキーごと消す
  await text("アリス").fill("");
  await expect
    .poll(async () =>
      readValue<string[]>(page, "return Object.keys(values.nicknames)"),
    )
    .toEqual(["bob"]);
});

test("キーが enum の partialRecord（既定）は、そのまま送信でき、空にしたキーは送信した値にも無い", async ({
  page,
  pageErrors: _,
}) => {
  await page.getByRole("textbox", { name: "アリス", exact: true }).fill("");
  await page
    .getByRole("textbox", { name: "キャロル", exact: true })
    .fill("キャリー");
  await submit(page);
  await expect
    .poll(async () => {
      const state = await formDemo(page);
      return state.submitted.count > 0
        ? (state.submitted.values as Record<string, unknown>).nicknames
        : undefined;
    })
    .toEqual({ carol: "キャリー" });
});

test("uiType entries の partialRecord は、値にあるキーだけを並べ、下の選択でまだ無いキーを足す", async ({
  page,
  pageErrors: _,
}) => {
  const box = section(page, "支店の数（partialRecord・uiType: entries）");
  // 定義順（California → Texas）で並ぶ
  await expect.poll(() => rowNames(box)).toEqual(["California", "Texas"]);

  // 文字で絞り込んで足す。足した行には値の既定値が入る（数値なので空）
  await addKey(page, box, "New Y", "New York");
  await expect
    .poll(() => rowNames(box))
    .toEqual(["California", "New York", "Texas"]);
  await expect
    .poll(async () =>
      readValue<string[]>(page, "return Object.keys(values.branches)"),
    )
    .toEqual(["Texas", "California", "New York"]);
  await box
    .getByRole("group", { name: "New York", exact: true })
    .getByRole("textbox")
    .fill("3");
  await expect
    .poll(async () => (await previewValue(page)).branches)
    .toEqual({ Texas: 2, California: 5, "New York": 3 });

  // もうあるキーは、選択の候補に出ない
  const select = box.getByRole("combobox", { name: "キーを追加" });
  await select.click();
  await select.fill("Calif");
  await expect(page.getByRole("option", { name: "California" })).toHaveCount(0);
  await select.press("Escape");
});

test("uiType entries の partialRecord の行を削除すると、キーごと値から消え、選択の候補に戻る", async ({
  page,
  pageErrors: _,
}) => {
  const box = section(page, "支店の数（partialRecord・uiType: entries）");
  await box.getByRole("button", { name: "Texasを削除" }).click();
  await expect.poll(() => rowNames(box)).toEqual(["California"]);
  await expect
    .poll(async () => (await previewValue(page)).branches)
    .toEqual({ California: 5 });

  await addKey(page, box, "Tex", "Texas");
  await expect.poll(() => rowNames(box)).toEqual(["California", "Texas"]);
});

test("keyOrder: value は、値の object の順に並べ、足したキーは末尾に並ぶ", async ({
  page,
  pageErrors: _,
}) => {
  const box = section(page, "支店の数（keyOrder: value）");
  await expect.poll(() => rowNames(box)).toEqual(["Texas", "California"]);
  await addKey(page, box, "Alab", "Alabama");
  await expect
    .poll(() => rowNames(box))
    .toEqual(["Texas", "California", "Alabama"]);
  await expect
    .poll(async () =>
      readValue<string[]>(page, "return Object.keys(values.branchesByValue)"),
    )
    .toEqual(["Texas", "California", "Alabama"]);
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
