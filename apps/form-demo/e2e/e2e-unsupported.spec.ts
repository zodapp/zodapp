import {
  expect,
  field,
  formDemo,
  openDemo,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e 用のページ：扱えない型は、その欄の場所に注記を出す
test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-unsupported", "e2e：扱えない型の注記");
});

const UNSUPPORTED = "このスキーマの組み合わせは、このフォームでは扱えません";

test("扱えない型の欄に注記を出し、ほかの欄は描く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "見出し")).toHaveValue("見出し");
  await expect(field(page, "使える値")).toHaveValue("y");
  await expect(field(page, "ハンドル（async の refine）")).toHaveValue("me");

  // rest 付きの tuple・合わない uiType の配列・Set<object> は「組み合わせ」の注記、promise は部品の無い型の注記
  await expect(page.getByText(UNSUPPORTED, { exact: true })).toHaveCount(3);
  await expect(
    page.getByText("このスキーマは、このフォームでは扱えません", {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.locator("[data-zod-form-unsupported]")).toHaveCount(4);
});

test("使えないキー名は注記を出し、record に保存されていた使えないキーは編集できない行で出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(
    page.getByText("このキー名は使えません", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("x.y", { exact: true })).toBeVisible();
  await expect(
    page.getByText("このフォームでは編集できません", { exact: true }),
  ).toBeVisible();
  // 使えるキーの行は編集できる
  await expect(page.locator('input[value="safe"]')).toBeEditable();
});

test("promise と async の refine があると、送信は止まり、理由が出る", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await waitSubmitSettled(page, 1);
  const state = await formDemo(page);
  expect(state.submitted.count).toBe(0);
  await expect(
    page.getByText("このフォームでは非同期の検証を扱えません").first(),
  ).toBeVisible();
});
