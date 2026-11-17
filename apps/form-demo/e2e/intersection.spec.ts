import type { Page } from "@playwright/test";
import {
  expect,
  field,
  openDemo,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// zf.intersection：両側を同じ path に並べ、flat の子は枠を付けずに並べる
test.beforeEach(async ({ page }) => {
  await openDemo(page, "intersection", "zf.intersection");
  await expect(field(page, "品名")).toHaveValue("本");
});

/** 見出し（legend・ラベル）の付いた枠 */
const sectionOf = (page: Page, label: string) =>
  page
    .locator("fieldset, .mantine-InputWrapper-root")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();

/** 欄・枠に出たエラーの文言（見るための部品の「エラー:」の行は数えない） */
const shownError = (page: Page, message: string) =>
  page.locator(".mantine-InputWrapper-error").filter({ hasText: message });

const valueOf = async (page: Page, key: string) =>
  (await previewValue(page))[key];

test("両側の欄に入力した値が、同じ object に入る", async ({
  page,
  pageErrors: _,
}) => {
  const flat = sectionOf(page, "flat（縦並び）");
  await flat.getByLabel(/^姓/).fill("佐藤");
  await flat.getByLabel(/^メール/).fill("a@example.com");
  await expect
    .poll(async () => valueOf(page, "flat"))
    .toMatchObject({ lastName: "佐藤", email: "a@example.com" });
});

test("子が box なら子の枠のまま、flat なら枠を付けずに並べる", async ({
  page,
  pageErrors: _,
}) => {
  // 子の枠のまま：名前・連絡先の枠（legend）が出る
  await expect(page.getByText("名前", { exact: true })).toBeVisible();
  await expect(page.getByText("連絡先", { exact: true })).toBeVisible();
  // flat：intersection の枠の中に、子の枠が無い
  await expect(
    sectionOf(page, "flat（縦並び）").locator("fieldset"),
  ).toHaveCount(0);
});

test("flat の子の欄は、横並びの intersection では同じ行に並ぶ", async ({
  page,
  pageErrors: _,
}) => {
  const section = sectionOf(page, "flat（横並び）");
  const lastName = await section.getByLabel(/^姓/).boundingBox();
  const email = await section.getByLabel(/^メール/).boundingBox();
  expect(lastName && email).toBeTruthy();
  // 別の子（名前の object と連絡先の object）の欄が、同じ行（同じ高さ）にある
  expect(Math.abs(lastName!.y - email!.y)).toBeLessThan(2);
  expect(email!.x).toBeGreaterThan(lastName!.x);
});

test("intersection 全体の .refine() のエラーは、1 回だけ出る", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(
    shownError(page, "開始と終了は別の値にしてください"),
  ).toHaveCount(1);
});

test("intersection の外の flat の object は、エラーがあるときだけエラーの box を出す", async ({
  page,
  pageErrors: _,
}) => {
  const message = shownError(page, "パスワードと確認が一致しません");
  await expect(message).toHaveCount(0);
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(message).toHaveCount(1);
  // エラーは box（fieldset）の中に出る
  await expect(page.locator("fieldset").filter({ has: message })).toHaveCount(
    1,
  );
});

test("object と union の intersection で、届け方を切り替えると欄が変わり、品名は残る", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "住所")).toBeVisible();
  await field(page, "届け方").click();
  await page.getByRole("option", { name: "メール", exact: true }).click();
  await expect(field(page, "送り先のメール")).toBeVisible();
  await expect(field(page, "住所")).toHaveCount(0);
  await expect
    .poll(async () => valueOf(page, "order"))
    .toMatchObject({ item: "本", method: "mail" });
  expect(await valueOf(page, "order")).not.toHaveProperty("address");
});

test("optional な intersection は、＋で開き、削除で undefined に戻る", async ({
  page,
  pageErrors: _,
}) => {
  const section = sectionOf(page, "追加の連絡先（optional）");
  await section.getByRole("button", { name: "追加" }).click();
  await expect.poll(async () => valueOf(page, "extra")).toEqual({});
  await expect(section.getByLabel(/^姓/)).toBeVisible();
  await section.getByRole("button", { name: "削除" }).click();
  await expect
    .poll(async () => (await previewValue(page)).extra)
    .toBeUndefined();
});
