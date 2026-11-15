import type { Page } from "@playwright/test";
import {
  expect,
  field,
  formDemo,
  openDemo,
  previewValue,
  test,
} from "./helpers";

// e2e：precision・unit で書かれる形（/form/detail?formId=e2e-precision）
const TITLE = "e2e：precision・unit で書かれる形";

// Z ありの日時を、保存値と同じ時刻で見せるため UTC で開く
test.use({ timezoneId: "UTC" });

const initialValues = {
  utcMinute: "2026-03-14T09:26:53.589Z",
  utcSecond: "2026-03-14T09:26:53.589Z",
  utcMillisecond: "2026-03-14T09:26:53.589Z",
  utcPrecisionMinute: "2026-03-14T09:26Z",
  utcPrecisionSecond: "2026-03-14T09:26:53Z",
  utcPrecisionMillisecond: "2026-03-14T09:26:53.589Z",
  localMinute: "2026-03-14T09:26:53.589",
  localSecond: "2026-03-14T09:26:53.589",
  localMillisecond: "2026-03-14T09:26:53.589",
  localPrecisionMinute: "2026-03-14T09:26",
  localPrecisionSecond: "2026-03-14T09:26:53",
  localPrecisionMillisecond: "2026-03-14T09:26:53.589",
  timeMinute: "09:26:53.589",
  timeSecond: "09:26:53.589",
  timeMillisecond: "09:26:53.589",
  timePrecisionMinute: "09:26",
  timePrecisionSecond: "09:26:53",
  timePrecisionMillisecond: "09:26:53.589",
};

test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-precision", TITLE);
  await expect(field(page, "時刻・precision 3")).toBeVisible();
});

/** 日時の欄で、表示中の月の選ばれていない最初の日（3 月 1 日）を選んで確定する */
const pickFirstDay = async (page: Page, label: string) => {
  await field(page, label).click();
  const dropdown = page.locator(".mantine-Popover-dropdown");
  await expect(dropdown).toBeVisible();
  await dropdown
    .locator("table button:not([data-selected]):not([data-outside])")
    .first()
    .click();
  await dropdown.locator(".mantine-DateTimePicker-submitButton").click();
  await expect(dropdown).toBeHidden();
};

test("開いただけでは値を書き換えない", async ({ page, pageErrors: _ }) => {
  const state = await formDemo(page);
  expect(state.isDirty).toBe(false);
  expect(state.values).toEqual(initialValues);
});

for (const zone of ["utc", "local"] as const) {
  const suffix = zone === "utc" ? "Z" : "";
  const prefix = zone === "utc" ? "Z" : "local";
  const cases = [
    // precision なしは unit で決まる。minute でも秒まで書き、秒は 00（保存値より粗い）
    {
      label: `${prefix}・unit minute`,
      key: `${zone}Minute`,
      expected: `2026-03-01T09:26:00${suffix}`,
    },
    // second は保存値のミリ秒より粗いので、ミリ秒を落とす
    {
      label: `${prefix}・unit second`,
      key: `${zone}Second`,
      expected: `2026-03-01T09:26:53${suffix}`,
    },
    {
      label: `${prefix}・precision -1`,
      key: `${zone}PrecisionMinute`,
      expected: `2026-03-01T09:26${suffix}`,
    },
    {
      label: `${prefix}・precision 0`,
      key: `${zone}PrecisionSecond`,
      expected: `2026-03-01T09:26:53${suffix}`,
    },
  ];
  // ミリ秒まで書く欄は、書かれる形（ミリ秒 3 桁）を確かめる
  const millisecondCases = [
    { label: `${prefix}・unit millisecond`, key: `${zone}Millisecond` },
    { label: `${prefix}・precision 3`, key: `${zone}PrecisionMillisecond` },
  ];

  test(`日時（${prefix}）の欄を編集すると、決めた形で書く`, async ({
    page,
    pageErrors: _,
  }) => {
    for (const c of cases) {
      await pickFirstDay(page, c.label);
      await expect
        .poll(async () => (await previewValue(page))[c.key])
        .toBe(c.expected);
    }
    for (const c of millisecondCases) {
      await pickFirstDay(page, c.label);
      await expect
        .poll(async () => (await previewValue(page))[c.key])
        .toMatch(new RegExp(`^2026-03-01T09:26:53\\.\\d{3}${suffix}$`));
    }
  });
}

test("時刻の欄を編集すると、決めた形で書く。unit が保存値より粗い欄は細かい部分が 0 になる", async ({
  page,
  pageErrors: _,
}) => {
  const cases = [
    // 保存値は 09:26:53.589。minute で編集すると秒は 00
    {
      label: "時刻・unit minute",
      key: "timeMinute",
      text: "10:15",
      expected: "10:15:00",
    },
    {
      label: "時刻・unit second",
      key: "timeSecond",
      text: "10:15:30",
      expected: "10:15:30",
    },
    {
      label: "時刻・unit millisecond",
      key: "timeMillisecond",
      text: "10:15:30.123",
      expected: "10:15:30.123",
    },
    {
      label: "時刻・precision -1",
      key: "timePrecisionMinute",
      text: "10:15",
      expected: "10:15",
    },
    {
      label: "時刻・precision 0",
      key: "timePrecisionSecond",
      text: "10:15:30",
      expected: "10:15:30",
    },
    {
      label: "時刻・precision 3",
      key: "timePrecisionMillisecond",
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
