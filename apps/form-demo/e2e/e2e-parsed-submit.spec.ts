import {
  expect,
  field,
  formDemo,
  openDemo,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e 用のページ：onSubmit に parse した値（z.output）が渡る
test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-parsed-submit", "e2e：送信する値の変換");
});

test("default・prefault は開くときに補い、開いただけでは isDirty は false", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "役割（default）")).toHaveValue("member");
  await expect(field(page, "ニックネーム（prefault）")).toHaveValue("guest");
  const state = await formDemo(page);
  expect(state.isDirty).toBe(false);
  expect(state.values).toMatchObject({ role: "member", nickname: "guest" });
});

test("送信する値は、trim・pipe・codec・stringbool・catch を通したもの", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "名前（trim）").fill("  山田  ");
  await field(page, "個数（coerce）").fill("3");
  await field(page, "コード（pipe で大文字）").fill("abc");
  await field(page, "数（codec）").fill("42");
  await field(page, "同意（stringbool）").fill("yes");
  await field(page, "略称（catch）").fill("ab");

  // フォームの値は入力のまま
  await expect
    .poll(async () => (await formDemo(page)).values)
    .toMatchObject({
      name: "  山田  ",
      code: "abc",
      amount: "42",
      agree: "yes",
    });

  await submit(page);
  await waitSubmitSettled(page, 1);
  const { submitted } = await formDemo(page);
  expect(submitted.count).toBe(1);
  expect(submitted.values).toEqual({
    name: "山田",
    role: "member",
    nickname: "guest",
    count: 3,
    code: "ABC",
    amount: 42,
    agree: true,
    shortName: "n/a",
  });
});
