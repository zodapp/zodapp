import { expect, field, openDemo, previewValue, test } from "./helpers";

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
