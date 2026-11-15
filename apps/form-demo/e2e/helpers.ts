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

/** 見るための部品が window.__formDemo に置く中身 */
export type FormDemoState = {
  formId: string;
  values: Record<string, unknown>;
  errors: { fields: Record<string, string[]>; form: string[] };
  isDirty: boolean;
  submitted: { count: number; values: unknown };
  log: (Record<string, unknown> & { type: string; at: number })[];
};

/** 見るための部品の中身（window.__formDemo）を読む */
export const formDemo = async (page: Page): Promise<FormDemoState> => {
  await page.waitForFunction(() => window.__formDemo !== undefined);
  return page.evaluate(() => window.__formDemo as unknown as FormDemoState);
};

/** 入力中の値 */
export const previewValue = async (
  page: Page,
): Promise<Record<string, unknown>> => (await formDemo(page)).values;

/** ログのうち、type が合うもの */
export const logOf = async (page: Page, type: string) =>
  (await formDemo(page)).log.filter((entry) => entry.type === type);

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
