import type { Page } from "@playwright/test";
import {
  dynamicStatuses,
  expect,
  field,
  fieldError,
  formDemo,
  logOf,
  openDemo,
  pendingFetch,
  previewValue,
  setDelayMode,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e：選択肢の届き方（/form/detail?formId=e2e-external-key）
// 手順はページの説明と同じ。待ち時間ではなく、画面の状態と window.__formDemo を待つ
const TITLE = "e2e：選択肢の届き方";
const UNLISTED_ERROR = "選択肢に無い値です。選び直してください。";
const MULTI_UNLISTED_ERROR =
  "選択肢に無い値があります。消すか、選び直してください。";
const WATCHERS = "見守る人（複数選択。部署で絞る。clear）";
const WATCHERS_KEEP = "見守る人（複数選択。部署で絞る。keep）";

test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-external-key", TITLE);
  // 開いたときの取得（見やすい遅延）が終わるまで待つ
  await expect(field(page, "担当者（部署で絞る。clear）")).toHaveValue(
    "鈴木 一郎（営業）",
  );
  await expect(dynamicStatuses(page)).toHaveCount(0);
  await expect(pills(page, WATCHERS)).toHaveText(["鈴木 一郎（営業）"]);
});

const chooseTeam = async (page: Page, label: "営業" | "開発") => {
  await page
    .getByTestId("team")
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click();
};

/** 担当者の 2 つの欄の値 */
const assignees = async (page: Page) => {
  const values = await previewValue(page);
  return [values.assignee, values.assigneeKeep];
};

/** 複数選択の 2 つの欄の値 */
const watchers = async (page: Page) => {
  const values = await previewValue(page);
  return [values.watchers, values.watchersKeep];
};

/** 複数選択の欄（入力の外側の枠） */
const multiField = (page: Page, label: string) =>
  field(page, label).locator(
    "xpath=ancestor::div[contains(@class,'mantine-InputWrapper-root')][1]",
  );

/** 複数選択の欄に並ぶ、選んだ値の表示 */
const pills = (page: Page, label: string) =>
  multiField(page, label).locator(".mantine-Pill-label");

test("選択肢を止めておいたまま部署を変え、そのあと届けると、clear の欄は消え、keep の欄は残ってエラーが出る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "止めておく");
  await chooseTeam(page, "開発");
  // 部署は取り直しの key に入るので、単一選択と複数選択の 4 つの欄が取り直しを待つ
  await expect(pendingFetch(page, "externalKey: members")).toHaveCount(4);
  // 届くまでは値に触らない
  expect(await assignees(page)).toEqual(["u-003", "u-003"]);
  expect(await watchers(page)).toEqual([["u-003"], ["u-003"]]);

  for (let i = 0; i < 4; i++) {
    await pendingFetch(page, "externalKey: members")
      .first()
      .getByRole("button", { name: "届ける" })
      .click();
  }
  await expect.poll(() => assignees(page)).toEqual([undefined, "u-003"]);
  await expect(field(page, "担当者（部署で絞る。keep）")).toHaveValue(
    "（不正な値）",
  );
  await expect(fieldError(page, "担当者（部署で絞る。keep）")).toHaveText(
    UNLISTED_ERROR,
  );
});

test("選択肢を止めておいたまま送信すると止まり、読み込み中の欄があることを出す", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "止めておく");
  await chooseTeam(page, "開発");
  await expect(pendingFetch(page, "externalKey: members")).toHaveCount(4);

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);
  await expect(page.getByTestId("form-submit-blocked")).toContainText(
    "読み込み中の欄があるため、送信できませんでした",
  );
});

test("同じ購読のまま選択肢が 0 件になると、clear の欄は消え、keep の欄は残る。戻すと keep の欄のエラーが消える", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  const calls = (await formDemo(page)).log.filter(
    (entry) => entry.type === "fetch" && entry.result === "called",
  ).length;

  await page.getByRole("button", { name: "選択肢を 0 件にする" }).click();
  await expect.poll(() => assignees(page)).toEqual([undefined, "u-003"]);
  // 0 件のあいだは選べない欄になる（値は残る）
  await expect(field(page, "担当者（部署で絞る。keep）")).toBeDisabled();

  await page.getByRole("button", { name: "選択肢を戻す" }).click();
  await expect(field(page, "担当者（部署で絞る。keep）")).toHaveValue(
    "鈴木 一郎（営業）",
  );
  await expect(fieldError(page, "担当者（部署で絞る。keep）")).toHaveCount(0);
  // clear の欄は、選択肢が戻っても値は戻らない
  expect((await assignees(page))[0]).toBeUndefined();
  // 購読は張り直していない
  expect(
    (await formDemo(page)).log.filter(
      (entry) => entry.type === "fetch" && entry.result === "called",
    ),
  ).toHaveLength(calls);
});

test("取得に失敗すると「再試行」が出て送信が止まり、取得できなかった欄があることを出す。失敗をやめて再試行すると戻る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  const failure = page.getByRole("switch", { name: /取得を失敗させる/ });
  await failure.check({ force: true });
  // 同じ購読のまま、届け直しが失敗する
  await page.getByRole("button", { name: "選択肢を戻す" }).click();
  const retry = page.getByRole("button", { name: "再試行" });
  // 担当者の 2 つの欄、複数選択の 2 つの欄とレビュー担当
  await expect(retry).toHaveCount(5);

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);
  await expect(page.getByTestId("form-submit-blocked")).toContainText(
    "取得できなかった欄があるため、送信できませんでした",
  );
  // 失敗しても値は消さない
  expect(await assignees(page)).toEqual(["u-003", "u-003"]);
  expect(await watchers(page)).toEqual([["u-003"], ["u-003"]]);
  // 複数選択の欄も、取得できなかったことと「再試行」を出す
  await expect(
    page
      .locator('[data-dynamic-status="error"]')
      .filter({ hasText: `${WATCHERS}を取得できませんでした` }),
  ).toBeVisible();

  await failure.uncheck({ force: true });
  while ((await retry.count()) > 0) {
    await retry.first().click();
  }
  await expect(retry).toHaveCount(0);
  await expect(field(page, "担当者（部署で絞る。clear）")).toHaveValue(
    "鈴木 一郎（営業）",
  );
  await submit(page);
  await waitSubmitSettled(page, 2);
  expect((await formDemo(page)).submitted.count).toBe(1);
  await expect(page.getByTestId("form-submit-blocked")).toHaveCount(0);
});

test("複数選択：選択肢を止めておいたまま部署を変えると読み込み中になり、届けると clear の欄は消え、keep の欄は「（不正な値）」とエラーが出る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "止めておく");
  await chooseTeam(page, "開発");
  await expect(pendingFetch(page, "externalKey: members")).toHaveCount(4);
  // 取り直しのあいだは、複数選択の欄も読み込み中（選べない）
  await expect(page.locator('[data-dynamic-status="pending"]')).toHaveCount(4);
  expect(await watchers(page)).toEqual([["u-003"], ["u-003"]]);

  for (let i = 0; i < 4; i++) {
    await pendingFetch(page, "externalKey: members")
      .first()
      .getByRole("button", { name: "届ける" })
      .click();
  }
  await expect.poll(() => watchers(page)).toEqual([undefined, ["u-003"]]);
  await expect(pills(page, WATCHERS)).toHaveCount(0);
  await expect(pills(page, WATCHERS_KEEP)).toHaveText(["（不正な値）"]);
  await expect(fieldError(page, WATCHERS_KEEP)).toHaveText(
    MULTI_UNLISTED_ERROR,
  );
  // clear の欄は、触る前は必須のエラーを出さない
  await expect(fieldError(page, WATCHERS)).toHaveCount(0);

  // 部署を戻すと、keep の欄は元の表示に戻り、clear の欄は戻らない
  await setDelayMode(page, "すぐ届く");
  await chooseTeam(page, "営業");
  await expect(pills(page, WATCHERS_KEEP)).toHaveText(["鈴木 一郎（営業）"]);
  await expect(fieldError(page, WATCHERS_KEEP)).toHaveCount(0);
  expect(await watchers(page)).toEqual([undefined, ["u-003"]]);
});

test("複数選択：同じ購読のまま選択肢が 0 件になると、clear の欄は消え、keep の欄は残って送信が止まる。戻すと keep の欄は元に戻る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  await page.getByRole("button", { name: "選択肢を 0 件にする" }).click();
  await expect.poll(() => watchers(page)).toEqual([undefined, ["u-003"]]);
  await expect(pills(page, WATCHERS_KEEP)).toHaveText(["（不正な値）"]);
  await expect(fieldError(page, WATCHERS_KEEP)).toHaveText(
    MULTI_UNLISTED_ERROR,
  );

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);

  await page.getByRole("button", { name: "選択肢を戻す" }).click();
  await expect(pills(page, WATCHERS_KEEP)).toHaveText(["鈴木 一郎（営業）"]);
  await expect(fieldError(page, WATCHERS_KEEP)).toHaveCount(0);
  // clear の欄は、選択肢が戻っても値は戻らない
  expect((await watchers(page))[0]).toBeUndefined();
});

test("複数選択：keep の欄の「（不正な値）」は × で消せる", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  await chooseTeam(page, "開発");
  await expect(pills(page, WATCHERS_KEEP)).toHaveText(["（不正な値）"]);
  await multiField(page, WATCHERS_KEEP)
    .locator(".mantine-Pill-root")
    .filter({ hasText: "（不正な値）" })
    .locator(".mantine-Pill-remove")
    .click();
  await expect.poll(async () => (await watchers(page))[1]).toBeUndefined();
  await expect(pills(page, WATCHERS_KEEP)).toHaveCount(0);
});

test("無い topic の欄は、取得できなかったことと「再試行」を出し、送信を止める", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  await page
    .getByRole("switch", { name: /無い topic の欄を出す/ })
    .check({ force: true });
  const missing = page
    .locator('[data-dynamic-status="error"]')
    .filter({ hasText: "無い topic の欄を取得できませんでした" });
  await expect(missing).toBeVisible();
  await expect(missing.getByRole("button", { name: "再試行" })).toBeVisible();
  // ほかの欄は失敗しない
  await expect(page.locator('[data-dynamic-status="error"]')).toHaveCount(1);
  // ログには、無い topic の購読の失敗が残る
  expect(
    (await logOf(page, "fetch")).some(
      (entry) => entry.field === "no-such-topic" && entry.result === "failed",
    ),
  ).toBe(true);

  // 再試行しても、topic が無いままなので失敗のまま
  await missing.getByRole("button", { name: "再試行" }).click();
  await expect(missing).toBeVisible();

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);
  await expect(page.getByTestId("form-submit-blocked")).toContainText(
    "取得できなかった欄があるため、送信できませんでした",
  );
});

test("clear で消えた欄には、触る前は必須のエラーが出ない。送信すると出る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  await chooseTeam(page, "開発");
  await expect.poll(() => assignees(page)).toEqual([undefined, "u-003"]);
  await expect(fieldError(page, "担当者（部署で絞る。clear）")).toHaveCount(0);

  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(fieldError(page, "担当者（部署で絞る。clear）")).toHaveText(
    "必ず入力してください。",
  );
  await expect(page.getByTestId("form-submit-blocked")).toContainText(
    "入力に誤りがあるため、送信できませんでした",
  );
});

test("上限が変わると、上限を超えたときだけエラーになり、値は消えない", async ({
  page,
  pageErrors: _,
}) => {
  const quantity = () => field(page, "数量");
  await expect(quantity()).toHaveValue("5");
  await page.getByRole("button", { name: "上限を 3 にする" }).click();
  await expect(page.getByText("上限（3）を超えています")).toBeVisible();
  expect((await previewValue(page)).quantity).toBe(5);

  await page.getByRole("button", { name: "上限を 10 にする" }).click();
  await expect(page.getByText("上限（3）を超えています")).toHaveCount(0);
  await expect(page.getByText("上限（10）を超えています")).toHaveCount(0);
  expect((await previewValue(page)).quantity).toBe(5);
});

for (const mode of ["すぐ届く", "1 フレーム後", "2 フレーム後"] as const) {
  test(`${mode}：部署を変えると、clear の欄は消え、keep の欄は残ってエラーが出る`, async ({
    page,
    pageErrors: _,
  }) => {
    await setDelayMode(page, mode);
    await chooseTeam(page, "開発");
    await expect.poll(() => assignees(page)).toEqual([undefined, "u-003"]);
    await expect(field(page, "担当者（部署で絞る。keep）")).toHaveValue(
      "（不正な値）",
    );
    await expect(fieldError(page, "担当者（部署で絞る。keep）")).toHaveText(
      UNLISTED_ERROR,
    );

    // 戻すと、keep の欄は元の表示に戻る
    await chooseTeam(page, "営業");
    await expect(field(page, "担当者（部署で絞る。keep）")).toHaveValue(
      "鈴木 一郎（営業）",
    );
    expect(await assignees(page)).toEqual([undefined, "u-003"]);
  });
}
