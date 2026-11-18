import type { Page } from "@playwright/test";
import {
  expect,
  field,
  formDemo,
  openDemo,
  previewValue,
  test,
} from "./helpers";

// z.iso.datetime の precision なしは、unit の粒度で書く（minute / second は秒まで）
test("precision なしの z.iso.datetime は、開いただけでは書き換えず、編集すると unit の形で書く", async ({
  page,
}) => {
  await openDemo(page, "date", "zf.date");
  const minuteField = field(page, "z.iso.datetime() - 分単位（minute）");
  await expect(minuteField).toBeVisible();

  // 開いただけでは初期値のまま
  const before = await previewValue(page);
  expect(before.isoDatetimeMinute).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/);
  expect(before.isoDatetimeDefault).toMatch(
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/,
  );

  // unit: minute の欄で日を選び直して確定すると、秒を 00 にして Z 付きで書く
  await minuteField.click();
  const dropdown = page.locator(".mantine-Popover-dropdown");
  await expect(dropdown).toBeVisible();
  // 今選ばれていない、表示中の月の日
  await dropdown
    .locator("table button:not([data-selected]):not([data-outside])")
    .first()
    .click();
  await dropdown.locator(".mantine-DateTimePicker-submitButton").click();
  await expect(dropdown).toBeHidden();

  await expect
    .poll(async () => (await previewValue(page)).isoDatetimeMinute)
    .toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/);
  const after = await previewValue(page);
  expect(after.isoDatetimeMinute).not.toBe(before.isoDatetimeMinute);
  // ほかの欄は触っていないので変わらない
  expect(after.isoDatetimeDefault).toBe(before.isoDatetimeDefault);
});

// ============================================================
// precision・unit で書かれる形（6. の欄。初期値は固定の日時）
// ============================================================

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
};

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

test.describe("precision・unit で書かれる形", () => {
  // Z ありの日時を、保存値と同じ時刻で見せるため UTC で開く
  test.use({ timezoneId: "UTC" });

  test.beforeEach(async ({ page }) => {
    await openDemo(page, "date", "zf.date");
    await expect(field(page, "local・precision 3")).toBeVisible();
  });

  test("開いただけでは値を書き換えない", async ({ page, pageErrors: _ }) => {
    const state = await formDemo(page);
    expect(state.isDirty).toBe(false);
    expect(state.values).toMatchObject(initialValues);
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
});
