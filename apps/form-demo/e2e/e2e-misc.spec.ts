import {
  choose,
  expect,
  field,
  formDemo,
  openDemo,
  optionsOf,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e 用のページ：そのほかの型の書き方
test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-misc", "e2e：そのほかの型の書き方");
});

test("object の形の enum は、キーを選択肢の名前にし、選ぶと値を書く", async ({
  page,
  pageErrors: _,
}) => {
  expect(await optionsOf(page, "サイズ")).toEqual(["Small", "Large"]);
  await choose(page, "サイズ", "Large");
  await expect.poll(async () => (await previewValue(page)).size).toBe("l");
});

test("値を複数持つ literal を multipleEnum の要素にでき、選ぶと配列に足す", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "色").click();
  await page.getByRole("option", { name: "green", exact: true }).click();
  await expect
    .poll(async () => (await previewValue(page)).colors)
    .toEqual(["red", "green"]);
});

test("外部キーの土台に z.email() を使え、選ぶとメールアドレスを書く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "連絡先メール")).toHaveValue("Alice Johnson");
  await choose(page, "連絡先メール", "Bob Smith");
  await expect
    .poll(async () => (await previewValue(page)).contactEmail)
    .toBe("bob@example.com");
});

test("zf.date に z.coerce.date() を渡せ、送信すると Date になる", async ({
  page,
  pageErrors: _,
}) => {
  // 日付の欄は、押すと選ぶ画面が開くボタン
  await expect(
    page.getByRole("button", { name: "期限（z.coerce.date()）" }),
  ).toHaveText(/2026-04-01/);
  // 外部キーの選択肢が届くまでは送信が止まるので、届くのを待つ
  await expect(field(page, "連絡先メール")).toHaveValue("Alice Johnson");
  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(1);
  const isDate = await page.evaluate(
    () =>
      (window.__formDemo?.submitted.values as { dueDate?: unknown })
        ?.dueDate instanceof Date,
  );
  expect(isDate).toBe(true);
});
