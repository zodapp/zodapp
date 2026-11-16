import {
  expect,
  field,
  fieldError,
  formDemo,
  openDemo,
  previewValue,
  test,
} from "./helpers";

// e2e：開いただけで書き換えるもの（/form/detail?formId=e2e-open-rewrite）
const TITLE = "e2e：開いただけで書き換えるもの";

test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-open-rewrite", TITLE);
  await expect(field(page, "メール")).toHaveValue("contact@example.com");
});

test("開くと、clear の欄は値が消え、keep の欄は残ってエラーが出る", async ({
  page,
  pageErrors: _,
}) => {
  await expect
    .poll(async () => (await previewValue(page)).officeClear)
    .toBeUndefined();
  expect((await previewValue(page)).officeKeep).toBe("closed-branch");
  await expect(field(page, "拠点（keep）")).toHaveValue("（不正な値）");
  await expect(fieldError(page, "拠点（keep）")).toHaveText(
    "選択肢に無い値です。選び直すか、消してください。",
  );
});

test("preprocess の union は、開くと type が補われた形になる", async ({
  page,
  pageErrors: _,
}) => {
  await expect
    .poll(async () => (await previewValue(page)).contact)
    .toEqual({ type: "email", email: "contact@example.com" });
});

test("precision の欄の値は初期値のまま", async ({ page, pageErrors: _ }) => {
  const values = await previewValue(page);
  expect(values.updatedAt).toBe("2026-03-14T09:26:53Z");
  expect(values.openAt).toBe("09:30");
});

test("開いただけでは isDirty は false。欄を 1 つ編集すると true になる", async ({
  page,
  pageErrors: _,
}) => {
  // 開いたときの書き換え（clear・preprocess）が終わってから確かめる
  await expect
    .poll(async () => (await previewValue(page)).officeClear)
    .toBeUndefined();
  await expect
    .poll(async () => (await previewValue(page)).contact)
    .toHaveProperty("type", "email");
  expect((await formDemo(page)).isDirty).toBe(false);

  await field(page, "メモ").fill("確認済み");
  await expect.poll(async () => (await formDemo(page)).isDirty).toBe(true);
});
