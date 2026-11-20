import {
  expect,
  field,
  formDemo,
  openDemo,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e 用のページ：欄を出さずにそのまま送る型
test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-passthrough", "e2e：欄を出さずにそのまま送る型");
});

test("any・unknown・custom・symbol・function・never・nan は欄を出さない", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "見出し")).toHaveValue("Heading");
  for (const label of [
    "any の値",
    "unknown の値",
    "custom の値",
    "symbol の値",
    "function の値",
    "never の値",
    "nan の値",
  ]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator("[data-zod-form-unsupported]")).toHaveCount(0);
});

test("templateLiteral は文字列の欄で、形に合わないと送信が止まる。nonoptional は空なら止まる", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "利用者 ID（templateLiteral）")).toHaveValue(
    "user-1",
  );
  await field(page, "利用者 ID（templateLiteral）").fill("admin");
  await submit(page);
  await waitSubmitSettled(page, 1);
  let state = await formDemo(page);
  expect(state.submitted.count).toBe(0);
  expect(Object.keys(state.errors.fields)).toEqual(
    expect.arrayContaining(["userId", "memo"]),
  );

  await field(page, "利用者 ID（templateLiteral）").fill("user-2");
  await field(page, "メモ（nonoptional）").fill("メモ");
  await submit(page);
  await waitSubmitSettled(page, 2);
  state = await formDemo(page);
  expect(state.submitted.count).toBe(1);
});

test("欄を出さない型の初期値は、そのまま送る", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "メモ（nonoptional）").fill("メモ");
  await submit(page);
  await waitSubmitSettled(page, 1);
  // symbol・function・NaN は JSON にならないので、ページの中で調べる
  const summary = await page.evaluate(() => {
    const values = window.__formDemo?.submitted.values as Record<
      string,
      unknown
    >;
    return {
      anyValue: values.anyValue,
      unknownValue: values.unknownValue,
      customValue: values.customValue,
      symbol: values.symbolValue === Symbol.for("e2e"),
      callback: typeof values.callback,
      nan: Number.isNaN(values.notANumber),
      hasNothing: "nothing" in values,
      userId: values.userId,
      memo: values.memo,
    };
  });
  expect(summary).toEqual({
    anyValue: { a: 1 },
    unknownValue: [1, 2],
    customValue: { id: 7 },
    symbol: true,
    callback: "function",
    nan: true,
    hasNothing: false,
    userId: "user-1",
    memo: "メモ",
  });
});
