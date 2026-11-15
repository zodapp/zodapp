import { expect, test as base, type Page } from "@playwright/test";

/** ページで起きた例外。各テストの終わりに、空であることを確かめる */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await provide(errors);
    expect(errors).toEqual([]);
  },
});

export { expect };

/** デモページを開き、見出しが出るまで待つ */
export const openDemo = async (page: Page, formId: string, title: string) => {
  await page.goto(`/form/detail?formId=${formId}`);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
};

/** 入力中の値（showPreview の JSON） */
export const previewValue = async (
  page: Page,
): Promise<Record<string, unknown>> =>
  JSON.parse(await page.locator("pre").first().innerText());

/** ラベルで欄を探す（ラベルは前方一致） */
export const field = (page: Page, label: string) =>
  page.getByLabel(new RegExp(`^${escape(label)}`)).first();

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 選択の欄で選ぶ */
export const choose = async (page: Page, label: string, option: string) => {
  await field(page, label).click();
  await page.getByRole("option", { name: option, exact: true }).first().click();
};

/** 選択の欄の選択肢を読む */
export const optionsOf = async (page: Page, label: string) => {
  await field(page, label).click();
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  const texts = await options.allInnerTexts();
  await page.keyboard.press("Escape");
  return texts;
};
