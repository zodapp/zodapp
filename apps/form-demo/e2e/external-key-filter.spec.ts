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
test.beforeEach(async ({ page }) => {
  await openDemo(page, "externalKeyFilter", "zf.externalKey（絞り込み）");
  await expect(field(page, "担当者")).toHaveValue("山田 太郎（営業）");
});

test("画面の部署で担当者の一覧が変わる。選んでいた人は消えずに残り、一覧に無いので表示できない", async ({
  page,
  pageErrors: _,
}) => {
  expect(await optionsOf(page, "担当者")).toEqual([
    "山田 太郎（営業）",
    "鈴木 一郎（営業）",
  ]);

  await page.getByText("開発", { exact: true }).first().click();
  await expect
    .poll(() => optionsOf(page, "担当者"))
    .toEqual(["佐藤 花子（開発）", "田中 次郎（開発）"]);
  // context の変更は利用者の編集ではないので、値は消えない（一覧に無いのでラベルは出ない）
  expect((await previewValue(page)).assignee).toBe("u-001");
  await expect(field(page, "担当者")).toHaveValue("");
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
