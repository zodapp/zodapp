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

// ============================================================
// 時刻の打ち込み（キーは一つずつ押す）。欄を空にしてから打つ
// ============================================================

const typingFields = [
  {
    label: "z.iso.time({ precision: 3 })",
    key: "stringMillisecond",
    text: "10:45:30.123",
    value: "10:45:30.123",
    format: "HH:mm:ss.SSS",
  },
  {
    label: "z.iso.time({ precision: 1 })",
    key: "stringTenthSecond",
    text: "10:45:30.1",
    value: "10:45:30.1",
    format: "HH:mm:ss.S",
  },
  {
    label: "z.number() millisecondsOfDay",
    key: "numberMillisecond",
    text: "10:45:30.123",
    value: ((10 * 60 + 45) * 60 + 30) * 1000 + 123,
    format: "HH:mm:ss.SSS",
  },
] as const;

test.describe("時刻の打ち込み", () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, "time", "zf.time");
    // 初期値を消して、空の欄から打つ
    for (const f of typingFields) await field(page, f.label).fill("");
  });

  for (const f of typingFields) {
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

  for (const f of typingFields.filter((f) => typeof f.value === "string")) {
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
});

// ============================================================
// precision・unit で書かれる形と、開いただけで書き換えないこと
// ============================================================

const initialValues = {
  stringMinute: "09:30",
  stringSecond: "09:30:15",
  stringUiMinute: "09:30:15.250",
  stringUiSecond: "09:30:15.250",
  stringUiMillisecond: "09:30:15.250",
  stringMillisecond: "09:30:15.250",
  stringTenthSecond: "09:30:15.2",
  numberHour: 9,
  numberMinute: 570,
  numberSecond: 34215,
  numberMillisecond: 34215250,
  readOnly: 570,
};

test.describe("precision・unit で書かれる形", () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, "time", "zf.time");
    await expect(field(page, "z.iso.time({ precision: 3 })")).toBeVisible();
  });

  test("開いただけでは値を書き換えない", async ({ page, pageErrors: _ }) => {
    const state = await formDemo(page);
    expect(state.isDirty).toBe(false);
    expect(state.values).toEqual(initialValues);
  });

  test("時刻の欄を編集すると、決めた形で書く。unit が保存値より粗い欄は細かい部分が 0 になる", async ({
    page,
    pageErrors: _,
  }) => {
    const cases = [
      // 保存値は 09:30:15.250。minute で編集すると秒は 00
      {
        label: "z.iso.time() - データは秒以下まで持てるが、UI は分まで",
        key: "stringUiMinute",
        text: "10:15",
        expected: "10:15:00",
      },
      {
        label: "z.iso.time() - UI は秒まで",
        key: "stringUiSecond",
        text: "10:15:30",
        expected: "10:15:30",
      },
      {
        label: "z.iso.time() - UI はミリ秒まで",
        key: "stringUiMillisecond",
        text: "10:15:30.123",
        expected: "10:15:30.123",
      },
      {
        label: "z.iso.time({ precision: -1 })",
        key: "stringMinute",
        text: "10:15",
        expected: "10:15",
      },
      {
        label: "z.iso.time({ precision: 0 })",
        key: "stringSecond",
        text: "10:15:30",
        expected: "10:15:30",
      },
      {
        label: "z.iso.time({ precision: 3 })",
        key: "stringMillisecond",
        text: "10:15:30.123",
        expected: "10:15:30.123",
      },
    ];
    for (const c of cases) {
      const input = field(page, c.label);
      await input.fill("");
      await input.pressSequentially(c.text);
      await input.blur();
      await expect
        .poll(async () => (await previewValue(page))[c.key])
        .toBe(c.expected);
    }
    expect((await formDemo(page)).isDirty).toBe(true);
  });
});
