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
  const boxed = sectionOf(page, "子の枠のまま");
  await expect(boxed.getByText("名前", { exact: true })).toBeVisible();
  await expect(boxed.getByText("連絡先", { exact: true })).toBeVisible();
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

test("intersection 全体の .refine() のエラーは、最後の欄（終了）を離すと出て、開始を離しただけでは出ない", async ({
  page,
  pageErrors: _,
}) => {
  const period = sectionOf(page, "期間（.refine()）");
  const error = shownError(page, "開始と終了は別の値にしてください");
  await period.getByLabel(/^開始/).focus();
  await period.getByLabel(/^開始/).blur();
  await period.getByLabel(/^終了/).focus();
  await expect(error).toHaveCount(0);
  await period.getByLabel(/^終了/).blur();
  await expect(error).toHaveCount(1);
});

test("送信で出た intersection 全体の .refine() のエラーは、開始を直すと消える", async ({
  page,
  pageErrors: _,
}) => {
  const error = shownError(page, "開始と終了は別の値にしてください");
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(error).toHaveCount(1);
  await sectionOf(page, "期間（.refine()）").getByLabel(/^開始/).fill("5月");
  await expect(error).toHaveCount(0);
});

test("子の object の .refine() のエラーは、同じ path の intersection の最後の欄を離すと出る", async ({
  page,
  pageErrors: _,
}) => {
  const section = sectionOf(page, "子の object の .refine()");
  const error = shownError(
    page,
    "パスワードと確認が一致しません（子の refine）",
  );
  // 子の object（パスワードの枠）の最後の欄を離しても、intersection の中なので出ない
  await section.getByLabel(/^確認/).focus();
  await section.getByLabel(/^確認/).blur();
  await expect(error).toHaveCount(0);
  // intersection の最後の欄（名前の枠の「名」）を離すと出る
  await section.getByLabel(/^名/).focus();
  await section.getByLabel(/^名/).blur();
  await expect(error).toHaveCount(1);
});

test("intersection の外の flat の object は、エラーがあるときだけエラーの Alert を出す", async ({
  page,
  pageErrors: _,
}) => {
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "パスワードと確認が一致しません" });
  await expect(alert).toHaveCount(0);
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(alert).toHaveCount(1);
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

/** 送信後、文言が 1 回だけ、legend の付いた枠の中に出ていること */
const expectOnceIn = async (page: Page, message: string, legend: string) => {
  const shown = shownError(page, message);
  await expect(shown).toHaveCount(1);
  await expect(
    page
      .locator("fieldset")
      .filter({ has: page.locator(":scope > legend", { hasText: legend }) })
      .filter({ has: shown }),
  ).toHaveCount(1);
};

test("子の object・union の腕の、path を指定しない .refine() は、intersection に 1 回だけ出る", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expectOnceIn(
    page,
    "パスワードと確認が一致しません（子の refine）",
    "子の object の .refine()",
  );
  // 子の枠（legend「パスワード」）の中には出ない
  await expect(
    page
      .locator("fieldset")
      .filter({
        has: page.locator(":scope > legend", { hasText: /^パスワード$/ }),
      })
      .filter({
        has: shownError(page, "パスワードと確認が一致しません（子の refine）"),
      }),
  ).toHaveCount(0);
  await expectOnceIn(
    page,
    "電話番号は 10 桁以上（z.union の腕の refine）",
    "z.union の腕の .refine()",
  );
  await expectOnceIn(
    page,
    "電話番号は 10 桁以上（discriminatedUnion の腕の refine）",
    "discriminatedUnion の腕の .refine()",
  );
});

test("横並びの .refine() のエラーと、子の欄の min(1) のエラーは、それぞれ 1 回だけ出る", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(
    shownError(page, "最小は最大より小さくしてください"),
  ).toHaveCount(1);
  // 欄のエラーは欄の下（コードの欄の InputWrapper）に出る
  const code = sectionOf(page, "子の欄の min(1)").getByLabel(/^コード/);
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(shownError(page, "コードを入力してください")).toHaveCount(1);
});

test("必須の intersection が空なら、「必ず入力してください。」だけを出す", async ({
  page,
  pageErrors: _,
}) => {
  // 開くときは {} で補われるので、値を外から消す
  await page
    .getByRole("button", {
      name: "外から書き込む（必須の intersection を空にする）",
    })
    .click();
  await submit(page);
  await waitSubmitSettled(page, 1);
  const section = page.locator("fieldset").filter({
    has: page.locator("legend", { hasText: "必須の intersection（空）" }),
  });
  await expect(
    section.locator(".mantine-InputWrapper-error", {
      hasText: "必ず入力してください。",
    }),
  ).toHaveCount(1);
  await expect(
    section.getByText("選択してください", { exact: true }),
  ).toHaveCount(0);
});

test("選んでいない腕のキーが残っていると、キーを持つ union の名前で選択を促す", async ({
  page,
  pageErrors: _,
}) => {
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expectOnceIn(
    page,
    "連絡方法と会員タイプを選択してください",
    "選んでいない腕のキー（intersection）",
  );
  // discriminatedUnion 単体：腕を選ぶ欄に出す
  await expectOnceIn(
    page,
    "連絡方法を選択してください",
    "選んでいない腕のキー（discriminatedUnion）",
  );
});
