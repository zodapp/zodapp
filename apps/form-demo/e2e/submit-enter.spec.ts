import {
  expect,
  field,
  fieldError,
  formDemo,
  openDemo,
  test,
  waitSubmitSettled,
} from "./helpers";

// Enter での送信：ブラウザが送信ボタンを押すが、送信ボタンをクリックしたときと違い、入力中の欄を離れない
test.beforeEach(async ({ page }) => {
  await openDemo(page, "validatePreceding", "前方フィールドの一括検証");
});

const fillAll = async (page: Parameters<typeof field>[0]) => {
  await field(page, "氏名（必須）").fill("山本");
  await field(page, "メールアドレス（必須）").fill("a@example.com");
  await field(page, "電話番号（必須）").fill("0312345678");
};

test("すべて入力して Enter を押すと、1 回で送信される", async ({
  page,
  pageErrors: _,
}) => {
  await fillAll(page);
  await field(page, "電話番号（必須）").press("Enter");
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(1);
});

test("空にして離れた欄を、離れずに直して Enter を押すと、1 回で送信される", async ({
  page,
  pageErrors: _,
}) => {
  await fillAll(page);

  // 空にして離れる：エラーが出る
  await field(page, "電話番号（必須）").fill("");
  await field(page, "電話番号（必須）").press("Tab");
  await expect(fieldError(page, "電話番号（必須）")).toHaveText(
    "必ず入力してください。",
  );

  // 戻って直す：入力中にエラーは消える
  await field(page, "電話番号（必須）").click();
  await field(page, "電話番号（必須）").fill("0312345678");
  await expect(fieldError(page, "電話番号（必須）")).toHaveCount(0);

  // 欄を離れずに Enter
  await field(page, "電話番号（必須）").press("Enter");
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(1);
});

test("空の欄があるまま Enter を押すと、1 回目で止まりエラーが出る", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "氏名（必須）").fill("山本");
  await field(page, "氏名（必須）").press("Enter");
  await waitSubmitSettled(page, 1);
  const state = await formDemo(page);
  expect(state.submitted.count).toBe(0);
  await expect(fieldError(page, "メールアドレス（必須）")).toHaveText(
    "メールアドレスを入力してください",
  );
  await expect(fieldError(page, "電話番号（必須）")).toHaveText(
    "電話番号を入力してください",
  );
});
