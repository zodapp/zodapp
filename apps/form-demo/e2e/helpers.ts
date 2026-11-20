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
  isDefaultValue: boolean;
  submitted: { count: number; values: unknown };
  log: (Record<string, unknown> & { type: string; at: number })[];
};

/** 入力中の値のうち、日本の住所（addressJp）。住所の連動のテストは日本の住所の欄で確かめる */
export const jpAddress = async (page: Page): Promise<Record<string, unknown>> =>
  ((await formDemo(page)).values.addressJp ?? {}) as Record<string, unknown>;

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

/** 遅延の分け方を選ぶ（「動きを試す」の枠を持つデモページ） */
export const setDelayMode = async (
  page: Page,
  label:
    | "見やすい遅延"
    | "すぐ届く"
    | "1 フレーム後"
    | "2 フレーム後"
    | "止めておく",
) => {
  await page
    .getByTestId("fetch-control")
    .locator("label")
    .filter({ hasText: new RegExp(`^${escape(label)}$`) })
    .click();
  await expect(page.getByTestId("delay-mode")).toHaveText(
    `選んだ分け方：${label}`,
  );
};

/** 止めておいた取得のうち、名前が合うもの */
export const pendingFetch = (page: Page, name: string) =>
  page.getByTestId("pending-fetch").filter({ hasText: name });

/** 見るための部品の「送信」を押す */
export const submit = async (page: Page) => {
  await page.getByRole("button", { name: "送信", exact: true }).click();
};

/** 送信の試みが n 回目まで終わる（通った・止まった）のを待つ */
export const waitSubmitSettled = async (page: Page, times: number) => {
  await expect
    .poll(
      async () =>
        (await logOf(page, "submit")).filter(
          (entry) => entry.result !== "attempted",
        ).length,
    )
    .toBe(times);
};

/** 選択の欄の × で値を消す */
export const clearSelect = async (page: Page, label: string) => {
  await field(page, label)
    .locator(
      "xpath=ancestor::div[contains(@class,'mantine-InputWrapper-root')][1]",
    )
    .locator("button")
    .first()
    .click();
};

/** 欄のエラーの表示（欄の下に出る文言） */
export const fieldError = (page: Page, label: string) =>
  field(page, label)
    .locator(
      "xpath=ancestor::div[contains(@class,'mantine-InputWrapper-root')][1]",
    )
    .locator(".mantine-InputWrapper-error");

/** 読み込み中・失敗の dynamic の欄 */
export const dynamicStatuses = (page: Page) =>
  page.locator("[data-dynamic-status]");
