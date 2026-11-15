import {
  choose,
  expect,
  field,
  openDemo,
  optionsOf,
  previewValue,
  test,
} from "./helpers";

// zf.externalKey（絞り込み）：部署で一覧を絞り、条件を変えたら一覧を取り直す
const ASSIGNEE = "担当者（画面上部で選んだ部署で絞る";
const KEEP = "担当者（unlisted: keep";

test.beforeEach(async ({ page }) => {
  await openDemo(page, "externalKeyFilter", "zf.externalKey（絞り込み）");
  await expect(field(page, ASSIGNEE)).toHaveValue("山田 太郎（営業）");
  await expect(field(page, KEEP)).toHaveValue("山田 太郎（営業）");
});

test("画面の部署で担当者の一覧が変わり、一覧から外れた値は消える", async ({
  page,
  pageErrors: _,
}) => {
  expect(await optionsOf(page, ASSIGNEE)).toEqual([
    "山田 太郎（営業）",
    "鈴木 一郎（営業）",
  ]);

  await page.getByText("開発", { exact: true }).first().click();
  await expect
    .poll(() => optionsOf(page, ASSIGNEE))
    .toEqual(["佐藤 花子（開発）", "田中 次郎（開発）"]);
  await expect
    .poll(async () => (await previewValue(page)).assignee)
    .toBeUndefined();
  await expect(field(page, ASSIGNEE)).toHaveValue("");
});

test("担当者を選んでから画面の部署を変えても、同じく消える", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, ASSIGNEE, "鈴木 一郎（営業）");
  await expect.poll(async () => (await previewValue(page)).assignee).toBe("u-003");

  await page.getByText("開発", { exact: true }).first().click();
  await expect
    .poll(async () => (await previewValue(page)).assignee)
    .toBeUndefined();
});

test("unlisted: keep の欄は、一覧から外れた値を残し、不正な値として出してエラーにする。部署を戻せば戻る", async ({
  page,
  pageErrors: _,
}) => {
  await page.getByText("開発", { exact: true }).first().click();
  // 一覧に無い値は、選べない選択肢として末尾に出る
  await expect
    .poll(() => optionsOf(page, KEEP))
    .toEqual(["佐藤 花子（開発）", "田中 次郎（開発）", "（不正な値）"]);
  expect((await previewValue(page)).assigneeKeep).toBe("u-001");
  await expect(field(page, KEEP)).toHaveValue("（不正な値）");
  await expect(page.getByText("選択肢に無い値です。選び直してください。")).toBeVisible();

  await page.getByText("営業", { exact: true }).first().click();
  await expect(field(page, KEEP)).toHaveValue("山田 太郎（営業）");
  expect((await previewValue(page)).assigneeKeep).toBe("u-001");
});

test("key ありの欄は部署を変えると取り直して値を消し、key なしの欄は取り直さない", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "レビューする部署", "開発");

  await expect
    .poll(async () => (await previewValue(page)).reviewer)
    .toBeUndefined();
  await expect
    .poll(() => optionsOf(page, "レビュー担当（key あり"))
    .toEqual(["佐藤 花子（開発）", "田中 次郎（開発）"]);

  expect((await previewValue(page)).reviewerWithoutKey).toBe("u-003");
  expect(await optionsOf(page, "レビュー担当（key なし")).toEqual([
    "山田 太郎（営業）",
    "鈴木 一郎（営業）",
  ]);
});
