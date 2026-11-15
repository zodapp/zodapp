import {
  expect,
  field,
  fieldError,
  formDemo,
  logOf,
  openDemo,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e：時刻の打ち込み（/form/detail?formId=e2e-time-input）。キーは一つずつ押す
const TITLE = "e2e：時刻の打ち込み";

const fields = [
  {
    label: "z.iso.time({ precision: 3 })",
    key: "millisecond",
    text: "10:45:30.123",
    value: "10:45:30.123",
    format: "HH:mm:ss.SSS",
  },
  {
    label: "z.iso.time({ precision: 1 })",
    key: "tenthSecond",
    text: "10:45:30.1",
    value: "10:45:30.1",
    format: "HH:mm:ss.S",
  },
  {
    label: "z.number() millisecondsOfDay",
    key: "millisecondsOfDay",
    text: "10:45:30.123",
    value: ((10 * 60 + 45) * 60 + 30) * 1000 + 123,
    format: "HH:mm:ss.SSS",
  },
] as const;

test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-time-input", TITLE);
});

for (const f of fields) {
  test(`${f.label}：空の欄に打って欄を出ると、表示も値も打ったとおり`, async ({
    page,
    pageErrors: _,
  }) => {
    const input = field(page, f.label);
    await expect(input).toHaveValue("");
    await input.pressSequentially(f.text);
    await expect(input).toHaveValue(f.text);
    await input.blur();
    await expect
      .poll(async () => (await previewValue(page))[f.key])
      .toBe(f.value);
    await expect(input).toHaveValue(f.text);
  });

  test(`${f.label}：途中の桁を Backspace で消して打ち直すと、打ったとおりになる`, async ({
    page,
    pageErrors: _,
  }) => {
    const input = field(page, f.label);
    await input.pressSequentially(f.text);
    // 「10:45」の「45」の後ろへ動かし、2 桁消して「50」を打つ
    await input.press("Home");
    for (let i = 0; i < 5; i++) await input.press("ArrowRight");
    await input.press("Backspace");
    await input.press("Backspace");
    await input.pressSequentially("50");
    const edited = f.text.replace("10:45", "10:50");
    await expect(input).toHaveValue(edited);
    await input.blur();
    await expect(input).toHaveValue(edited);
    const expected =
      typeof f.value === "number"
        ? f.value + 5 * 60 * 1000
        : f.value.replace("10:45", "10:50");
    await expect
      .poll(async () => (await previewValue(page))[f.key])
      .toBe(expected);
  });

  test(`${f.label}：Enter で値に入る`, async ({ page, pageErrors: _ }) => {
    const input = field(page, f.label);
    await input.pressSequentially(f.text);
    await input.press("Enter");
    await expect
      .poll(async () => (await previewValue(page))[f.key])
      .toBe(f.value);
    await expect(input).toHaveValue(f.text);
  });
}

for (const f of fields.filter((f) => typeof f.value === "string")) {
  test(`${f.label}：読めない値で欄を出ると、形のエラーが出て送信が止まる。前の値は残らない`, async ({
    page,
    pageErrors: _,
  }) => {
    const input = field(page, f.label);
    await input.pressSequentially(f.text);
    await input.blur();
    await expect
      .poll(async () => (await previewValue(page))[f.key])
      .toBe(f.value);

    await input.fill("");
    await input.pressSequentially("9:30");
    await input.blur();
    await expect(input).toHaveValue("9:30");
    await expect(fieldError(page, f.label)).toHaveText(
      `${f.format} の形で、正しい時刻を入力してください`,
    );
    // 前の値を黙って残さない
    await expect
      .poll(async () => (await previewValue(page))[f.key])
      .not.toBe(f.value);

    await submit(page);
    await waitSubmitSettled(page, 1);
    expect((await formDemo(page)).submitted.count).toBe(0);
    expect((await logOf(page, "submit")).at(-1)?.result).toBe("blocked");
  });

  test(`${f.label}：範囲外の値で欄を出ると、必須ではなく形のエラーが出る`, async ({
    page,
    pageErrors: _,
  }) => {
    const input = field(page, f.label);
    await input.pressSequentially("12:60:00");
    await input.blur();
    await expect(input).toHaveValue("12:60:00");
    await expect(fieldError(page, f.label)).toHaveText(
      `${f.format} の形で、正しい時刻を入力してください`,
    );
    await expect(fieldError(page, f.label)).not.toHaveText(/必ず入力/);
  });
}
