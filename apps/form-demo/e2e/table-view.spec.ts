import { expect, openDemo, test } from "./helpers";

// 表（AutoTable）
test("行の値から計算した小計、通貨で変わる金額、選択肢のラベル、時刻を表に出す", async ({
  page,
  pageErrors: _,
}) => {
  await openDemo(page, "tableView", "表（AutoTable）");
  const table = page.getByRole("table");
  const row = (id: string) => table.getByRole("row").filter({ hasText: id });

  // 拠点はラベルで出し、選択肢に無い値はそのまま出す
  await expect(row("r1")).toContainText("東京本社");
  await expect(row("r3")).toContainText("closed-branch");
  // 担当は一覧が届くとラベルで出る
  await expect(row("r1")).toContainText("山田 太郎");
  // 小計（単価 × 数量）
  await expect(row("r2")).toContainText("¥5,000");
  // 金額は行の通貨で表示が変わる
  await expect(row("r1")).toContainText("¥3,600");
  await expect(row("r2")).toContainText("$49.99");
  // 開始（0 時からの分）
  await expect(row("r1")).toContainText("09:30");
});
