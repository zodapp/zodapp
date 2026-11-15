import { expect, field, openDemo, previewValue, test } from "./helpers";

// zf.time のミリ秒の欄（HH:mm:ss.SSS を打ち込む）
const MILLISECOND_LABEL = "z.iso.time({ precision: 3 })";
const FORMAT_ERROR = "HH:mm:ss.SSS の形で、正しい時刻を入力してください";

test("ミリ秒の欄は、1 文字ずつ打っても崩れず、確定したときに書く", async ({
  page,
  pageErrors: _,
}) => {
  await openDemo(page, "time", "zf.time");
  const input = field(page, MILLISECOND_LABEL);
  await expect(input).toHaveValue("09:30:15.250");

  // 空にして 1 文字ずつ打つ。打っている途中で整えた値に戻って、文字が崩れることはない
  await input.fill("");
  await input.pressSequentially("10:45:30.123");
  await expect(input).toHaveValue("10:45:30.123");
  await input.blur();
  await expect
    .poll(async () => (await previewValue(page)).stringMillisecond)
    .toBe("10:45:30.123");
  await expect(input).toHaveValue("10:45:30.123");

  // 途中を Backspace で消しても戻らず、Enter で残った文字を書く
  await input.click();
  await input.press("End");
  await input.press("Backspace");
  await input.press("Backspace");
  await expect(input).toHaveValue("10:45:30.1");
  await input.press("Enter");
  await expect(input).toHaveValue("10:45:30.100");
  await expect
    .poll(async () => (await previewValue(page)).stringMillisecond)
    .toBe("10:45:30.100");
});

test("ミリ秒の欄に読めない時刻を打つと、前の値を残さず形式のエラーを出す", async ({
  page,
  pageErrors: _,
}) => {
  await openDemo(page, "time", "zf.time");
  const input = field(page, MILLISECOND_LABEL);
  await expect(input).toHaveValue("09:30:15.250");

  for (const text of ["9:30", "12:60:00", "24:00:00.000"]) {
    await input.fill("");
    await input.pressSequentially(text);
    await input.blur();
    await expect(input).toHaveValue(text);
    await expect(page.getByText(FORMAT_ERROR)).toBeVisible();
    await expect(page.getByText("必ず入力してください")).toHaveCount(0);
    // 前の値を黙って残さない（画面の文字と値が食い違わない）
    await expect
      .poll(async () => (await previewValue(page)).stringMillisecond)
      .toBe(text);
  }

  // 直すとエラーが消える
  await input.fill("");
  await input.pressSequentially("08:00:00.5");
  await input.blur();
  await expect(input).toHaveValue("08:00:00.500");
  await expect(page.getByText(FORMAT_ERROR)).toHaveCount(0);
  await expect
    .poll(async () => (await previewValue(page)).stringMillisecond)
    .toBe("08:00:00.500");
});
