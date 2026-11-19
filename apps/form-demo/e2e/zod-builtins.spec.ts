import {
  expect,
  field,
  openDemo,
  optionsOf,
  choose,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// zod の型をそのまま使う：zf を使わずに書いた型の表示
test.beforeEach(async ({ page }) => {
  await openDemo(page, "zodBuiltins", "zod の型をそのまま使う");
});

/** 値が value の入力欄 */
const inputWithValue = (page: import("@playwright/test").Page, value: string) =>
  page.locator(`input[value="${value}"]`);

/** window.__formDemo の値を、ページの中で取り出す（Map・File は JSON にならないため） */
const readValue = <T>(page: import("@playwright/test").Page, fn: string) =>
  page.evaluate(
    // eslint-disable-next-line no-new-func
    (body) => new Function("values", body)(window.__formDemo?.values) as T,
    fn,
  );

test("数値の TS enum は、キーを選択肢の名前にし、選ぶと数を書く", async ({
  page,
  pageErrors: _,
}) => {
  expect(await optionsOf(page, "優先度")).toEqual(["Low", "Middle", "High"]);
  await choose(page, "優先度", "High");
  await expect
    .poll(() => readValue<number>(page, "return values.priority"))
    .toBe(3);
});

test("Map のキーと値を描き、値を書き換えると Map に書く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(inputWithValue(page, "daily")).toBeVisible();
  await expect(inputWithValue(page, "monthly")).toBeVisible();
  await inputWithValue(page, "100").fill("200");
  await expect
    .poll(() =>
      readValue<[string, number][]>(page, "return Array.from(values.limits)"),
    )
    .toEqual([
      ["daily", 10],
      ["monthly", 200],
    ]);
});

test("ファイルを選ぶと File を書く", async ({ page, pageErrors: _ }) => {
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "memo.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
  await expect
    .poll(() => readValue<string>(page, "return values.attachment?.name"))
    .toBe("memo.txt");
});

test("readonly な object の中の欄を描き、入力できる", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "著者名").fill("佐藤");
  await expect
    .poll(() => readValue<string>(page, "return values.author.name"))
    .toBe("佐藤");
});

test("再帰は maxDepth（3）で止まり、注記を出す。その先の値は消さずに送る", async ({
  page,
  pageErrors: _,
}) => {
  await expect(inputWithValue(page, "第1項")).toBeVisible();
  await expect(inputWithValue(page, "第1目")).toHaveCount(0);
  await expect(
    page.getByText("これより深い階層は表示できません", { exact: false }),
  ).toBeVisible();
  await submit(page);
  await waitSubmitSettled(page, 1);
  expect(
    await readValue<string>(
      page,
      "return values.outline.child.child.child.name",
    ),
  ).toBe("第1目");
});
