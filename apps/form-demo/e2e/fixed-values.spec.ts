import type { Page } from "@playwright/test";

import {
  expect,
  formDemo,
  openDemo,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// 固定値：既定では欄を出さず、hidden: false で readOnly と同じ見た目で出す
test.beforeEach(async ({ page }) => {
  await openDemo(page, "fixedValues", "固定値（hidden: false）");
});

/** 枠（fieldset）の見出しで、左右（上下）の入れ物を探す */
const box = (page: Page, legend: string) =>
  page
    .locator("fieldset")
    .filter({
      has: page.locator("legend", { hasText: legend }),
    })
    .first();

test("既定では固定値の欄を出さず、hidden: false では値を出す", async ({
  page,
  pageErrors: _,
}) => {
  const standard = box(page, "既定（固定値を出さない）");
  const shown = box(page, "hidden: false（固定値を出す）");

  // 既定：種別・版・連絡の種類は出ない
  await expect(standard.getByText("種別", { exact: true })).toHaveCount(0);
  await expect(standard.getByText("版", { exact: true })).toHaveCount(0);
  await expect(standard.getByText("連絡の種類", { exact: true })).toHaveCount(
    0,
  );

  // hidden: false：readOnly と同じ見た目で値を出す（入力欄ではない）
  await expect(shown.getByText("種別", { exact: true })).toBeVisible();
  await expect(shown.getByText("article", { exact: true })).toBeVisible();
  await expect(shown.getByText("版", { exact: true })).toBeVisible();
  await expect(shown.getByText("2", { exact: true })).toBeVisible();
  await expect(shown.getByText("連絡の種類", { exact: true })).toBeVisible();
  await expect(shown.getByText("email", { exact: true })).toBeVisible();
  await expect(shown.locator('input[value="article"]')).toHaveCount(0);

  // z.null() は中身が無いので、hidden: false でも出さない
  await expect(page.getByText("削除日時", { exact: true })).toHaveCount(0);
});

test("連絡先を電話に切り替えると、hidden: false の discriminator も phone になる", async ({
  page,
  pageErrors: _,
}) => {
  const shown = box(page, "hidden: false（固定値を出す）");
  await shown.getByLabel(/^連絡先の選び方/).click();
  await page.getByRole("option", { name: "電話", exact: true }).click();
  await expect(shown.getByText("phone", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const values = (await formDemo(page)).values as {
        shown: { contact: { type: string } };
      };
      return values.shown.contact.type;
    })
    .toBe("phone");
});

test("どちらも、送信する値には固定値が入る", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await waitSubmitSettled(page, 1);
  const { submitted } = await formDemo(page);
  const expected = {
    kind: "article",
    version: 2,
    title: "お知らせ",
    deletedAt: null,
    contact: { type: "email", email: "info@example.com" },
  };
  expect(submitted.values).toEqual({ standard: expected, shown: expected });
});
