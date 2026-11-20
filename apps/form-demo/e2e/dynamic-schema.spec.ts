import {
  choose,
  expect,
  field,
  formDemo,
  openDemo,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// zf.dynamic：決まったスキーマの既定値（.default()）を、値が無いところに補う
test.beforeEach(async ({ page }) => {
  await openDemo(page, "dynamicSchema", "zf.dynamic");
  await expect(field(page, "件名")).toBeVisible();
});

const notificationOf = async (page: Parameters<typeof previewValue>[0]) =>
  (await previewValue(page)).notification as Record<string, unknown>;

test("開くと、初期値に無い欄を既定値で補い、入っている値は変えない", async ({
  page,
  pageErrors: _,
}) => {
  await expect
    .poll(async () => (await notificationOf(page)).format)
    .toBe("text");
  await expect(field(page, "本文の形式")).toHaveValue("テキスト");
  expect(await notificationOf(page)).toEqual({
    type: "email",
    to: "alert@example.com",
    subject: "[ALERT] An outage occurred",
    format: "text",
  });
});

test("補っても、開いただけでは isDefaultValue のまま（変更なし）。欄を編集すると false になる", async ({
  page,
  pageErrors: _,
}) => {
  await expect
    .poll(async () => (await notificationOf(page)).format)
    .toBe("text");
  await expect
    .poll(async () => (await formDemo(page)).isDefaultValue)
    .toBe(true);
  expect((await formDemo(page)).isDirty).toBe(false);

  await field(page, "件名").fill("変更した件名");
  await expect
    .poll(async () => (await formDemo(page)).isDefaultValue)
    .toBe(false);
});

test("通知方法を切り替えると、新しいスキーマの既定値で補う", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "通知方法", "Webhook");
  await expect(field(page, "再試行の回数")).toHaveValue("3");
  await expect.poll(async () => (await notificationOf(page)).retries).toBe(3);
});

test("補った既定値は、送信した値にも入る", async ({ page, pageErrors: _ }) => {
  await expect
    .poll(async () => (await notificationOf(page)).format)
    .toBe("text");
  await submit(page);
  await waitSubmitSettled(page, 1);
  const state = await formDemo(page);
  expect(state.submitted.count).toBe(1);
  expect(
    (state.submitted.values as { notification: { format: string } })
      .notification.format,
  ).toBe("text");
});
