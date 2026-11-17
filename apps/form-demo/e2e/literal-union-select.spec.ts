import type { Page } from "@playwright/test";
import {
  choose,
  clearSelect,
  expect,
  field,
  fieldError,
  openDemo,
  previewValue,
  submit,
  test,
} from "./helpers";

// literal の union を選ぶ：uiType の select・badge と、配列の multipleEnum・multipleEnumBadge
test.beforeEach(async ({ page }) => {
  await openDemo(page, "literalUnionSelect", "zf.union（literal）");
  await expect(field(page, "価格（optional）")).toHaveValue("10（文字）");
});

/** 欄の入れ物。入れ子の外側も一致するので、いちばん内側（最後）を採る */
const wrapperOf = (page: Page, label: string) =>
  page
    .locator(".mantine-InputWrapper-root")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();

const valueOf = async (page: Page, key: string) => {
  const values = await previewValue(page);
  return { has: key in values, value: values[key] };
};

test('数値の腕を選ぶと数値、文字列の腕を選ぶと文字列を書く（10 と "10" を区別する）', async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "価格（必須）", "10（数値）");
  await expect.poll(async () => (await valueOf(page, "price")).value).toBe(10);
  await expect(field(page, "価格（必須）")).toHaveValue("10（数値）");

  await choose(page, "価格（必須）", "10（文字）");
  await expect
    .poll(async () => (await valueOf(page, "price")).value)
    .toBe("10");
  await expect(field(page, "価格（必須）")).toHaveValue("10（文字）");
});

test("保存済みの数値の値は、数値の腕のラベルで出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "価格（nullable）")).toHaveValue("10（数値）");
});

test("必須のまま空で送信すると「必ず入力してください。」を出す", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await expect(fieldError(page, "価格（必須）")).toHaveText(
    "必ず入力してください。",
  );
  // 選ぶとエラーが消える
  await choose(page, "価格（必須）", "無料");
  await expect(fieldError(page, "価格（必須）")).toHaveCount(0);
});

test("optional なら × で undefined、nullable だけなら null に戻す", async ({
  page,
  pageErrors: _,
}) => {
  await clearSelect(page, "価格（optional）");
  await clearSelect(page, "価格（nullable）");
  await expect
    .poll(async () => (await valueOf(page, "optionalPrice")).value)
    .toBeUndefined();
  await expect
    .poll(async () => (await valueOf(page, "nullablePrice")).value)
    .toBeNull();
  await expect(fieldError(page, "価格（optional）")).toHaveCount(0);
  await expect(fieldError(page, "価格（nullable）")).toHaveCount(0);
});

test("バッジの形は、選んだ選択肢をバッジで出す", async ({
  page,
  pageErrors: _,
}) => {
  const badge = wrapperOf(page, "サイズ（badge）").getByTestId(
    "badge-select-value",
  );
  await expect(badge).toHaveText("大");
  await choose(page, "サイズ（badge）", "中");
  await expect(badge).toHaveText("中");
  await expect.poll(async () => (await valueOf(page, "size")).value).toBe(2);
});

test("複数選ぶ形は、選んだ値を数値・文字列のまま配列に入れ、全部外すと空になる", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "価格（multipleEnum）", "10（文字）");
  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await valueOf(page, "prices")).value)
    .toEqual([10, "free", "10"]);

  // MultiSelect の先頭のボタンは選んだ値の ×。クリアのボタンは最後にある
  await wrapperOf(page, "価格（multipleEnum）")
    .locator("button")
    .last()
    .click();
  await expect
    .poll(async () => (await valueOf(page, "prices")).value)
    .toBeUndefined();
});

test("複数選ぶ・バッジの形は、選んだ値をバッジで出し、× で外せる", async ({
  page,
  pageErrors: _,
}) => {
  const wrapper = wrapperOf(page, "サイズ（multipleEnumBadge）");
  await expect(wrapper.locator(".mantine-Badge-root")).toHaveText(["小", "大"]);
  await wrapper.getByRole("button", { name: "小を外す" }).click();
  await expect(wrapper.locator(".mantine-Badge-root")).toHaveText(["大"]);
  await expect
    .poll(async () => (await valueOf(page, "sizes")).value)
    .toEqual(["large"]);
});

/** 欄の × の数（Select のクリアのボタン） */
const clearButtonCount = (page: Page, label: string) =>
  field(page, label)
    .locator(
      "xpath=ancestor::div[contains(@class,'mantine-InputWrapper-root')][1]",
    )
    .locator("button")
    .count();

test("literal に入るすべての値と null・undefined の腕を選び、その値を書く", async ({
  page,
  pageErrors: _,
}) => {
  const label = "回答（すべての値）";
  // 値が無いときは undefined の腕に見える
  await expect(field(page, label)).toHaveValue("未回答");
  const cases: [string, unknown][] = [
    ["いいえ", false],
    ["該当なし", null],
    ["b", "b"],
    ["はい", true],
  ];
  for (const [option, value] of cases) {
    await choose(page, label, option);
    await expect
      .poll(async () => (await valueOf(page, "answer")).value)
      .toBe(value);
    await expect(field(page, label)).toHaveValue(option);
  }
  // bigint の腕は 10n と出す
  await choose(page, label, "10n");
  await expect(field(page, label)).toHaveValue("10n");
  await choose(page, label, "未回答");
  await expect.poll(async () => (await valueOf(page, "answer")).has).toBe(true);
  expect((await valueOf(page, "answer")).value).toBeUndefined();
});

test("optional・nullable と併用すると腕を優先し、腕で表せないときだけ × を出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "回答（optional・undefined の腕）")).toHaveValue(
    "未回答",
  );
  expect(await clearButtonCount(page, "回答（optional・undefined の腕）")).toBe(
    0,
  );
  await expect(field(page, "回答（nullable・null の腕）")).toHaveValue("はい");
  expect(await clearButtonCount(page, "回答（nullable・null の腕）")).toBe(0);

  // null の腕を選ぶと null を書く（空の値に置き換えない）
  await choose(page, "回答（nullable・null の腕）", "該当なし");
  await expect
    .poll(async () => (await valueOf(page, "answerNullable")).value)
    .toBeNull();
  await expect(field(page, "回答（nullable・null の腕）")).toHaveValue(
    "該当なし",
  );

  // optional・nullable で undefined の腕だけなら、× で null を書く
  await clearSelect(page, "回答（optional・nullable・undefined の腕）");
  await expect
    .poll(async () => (await valueOf(page, "answerBoth")).value)
    .toBeNull();
});
