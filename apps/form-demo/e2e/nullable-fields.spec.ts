import type { Page } from "@playwright/test";
import {
  clearSelect,
  expect,
  field,
  fieldError,
  formDemo,
  openDemo,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// nullable・optional：空にしたときに書く値と、object の＋・削除
test.beforeEach(async ({ page }) => {
  await openDemo(page, "nullableFields", "nullable・optional");
  await expect(field(page, "文字（nullable）")).toHaveValue("Filled in");
});

/** ラベルの付いた object の欄（一番内側の枠） */
const objectField = (page: Page, label: string) =>
  page
    .locator(".mantine-InputWrapper-root")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();

const valueOf = async (page: Page, key: string) => {
  const values = await previewValue(page);
  return { has: key in values, value: values[key] };
};

test("nullable だけの文字・数値・選択の欄は、空にすると null を書き、エラーを出さない", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "文字（nullable）").fill("");
  await field(page, "数値（nullable）").fill("");
  await clearSelect(page, "色（nullable）");
  await field(page, "文字（optional）").click();

  await expect
    .poll(async () => (await valueOf(page, "nullableText")).value)
    .toBeNull();
  await expect
    .poll(async () => (await valueOf(page, "nullableNumber")).value)
    .toBeNull();
  await expect
    .poll(async () => (await valueOf(page, "nullableColor")).value)
    .toBeNull();
  await expect(fieldError(page, "文字（nullable）")).toHaveCount(0);
  await expect(fieldError(page, "数値（nullable）")).toHaveCount(0);
});

test("nullable だけの日付の欄は、× で消すと null を書き、エラーを出さない", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "日付（nullable）")).toHaveValue("2026-11-17");
  // 日付の欄の × は、選択の欄と同じく欄の右端のボタン
  await clearSelect(page, "日付（nullable）");
  await expect(field(page, "日付（nullable）")).toHaveValue("");
  await expect
    .poll(async () => (await valueOf(page, "nullableDate")).value)
    .toBeNull();
  await field(page, "文字（optional）").click();
  await expect(fieldError(page, "日付（nullable）")).toHaveCount(0);
});

test("optional の欄は、optional と nullable の両方でも、空にすると undefined を書く", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "文字（optional・nullable）").fill("");
  await field(page, "文字（optional）").fill("");
  await field(page, "文字（nullable）").click();

  await expect
    .poll(async () => (await previewValue(page)).optionalNullableText)
    .toBeUndefined();
  await expect
    .poll(async () => (await previewValue(page)).optionalText)
    .toBeUndefined();
});

test("nullable だけの欄を空にしたまま送信できる", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "文字（nullable）").fill("");
  await field(page, "数値（nullable）").fill("");
  await clearSelect(page, "色（nullable）");
  await submit(page);
  await waitSubmitSettled(page, 1);
  const state = await formDemo(page);
  expect(state.submitted.count).toBe(1);
  expect(state.submitted.values).toMatchObject({
    nullableText: null,
    nullableNumber: null,
    nullableColor: null,
  });
});

test("nullable の object は null で始まり、＋で開くと既定値の入った形になり、削除で null に戻る", async ({
  page,
  pageErrors: _,
}) => {
  const detail = objectField(page, "詳細（nullable）");
  expect((await previewValue(page)).nullableDetail).toBeNull();
  await expect(field(page, "備考")).toHaveCount(0);

  await detail.getByRole("button", { name: "追加" }).click();
  await expect(field(page, "備考")).toBeVisible();
  await expect(field(page, "件数")).toHaveValue("1");
  await expect
    .poll(async () => (await previewValue(page)).nullableDetail)
    .toEqual({ count: 1 });

  await objectField(page, "詳細（nullable）")
    .getByRole("button", { name: "削除" })
    .click();
  await expect(field(page, "備考")).toHaveCount(0);
  await expect
    .poll(async () => (await previewValue(page)).nullableDetail)
    .toBeNull();
});

test("optional の object は、削除で undefined に戻り、＋でまた開ける", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "メモ")).toHaveValue("Note");
  await objectField(page, "補足（optional）")
    .getByRole("button", { name: "削除" })
    .click();
  await expect(field(page, "メモ")).toHaveCount(0);
  await expect
    .poll(async () => (await previewValue(page)).optionalDetail)
    .toBeUndefined();

  await objectField(page, "補足（optional）")
    .getByRole("button", { name: "追加" })
    .click();
  await expect(field(page, "メモ")).toBeVisible();
  await expect
    .poll(async () => (await previewValue(page)).optionalDetail)
    .toEqual({});
});
