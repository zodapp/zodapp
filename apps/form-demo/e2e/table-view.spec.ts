import type { Page } from "@playwright/test";
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
  await expect(row("r1")).toContainText("New York headquarters");
  await expect(row("r3")).toContainText("closed-branch");
  // 担当は一覧が届くとラベルで出る
  await expect(row("r1")).toContainText("Alice Johnson");
  // 小計（単価 × 数量）
  await expect(row("r2")).toContainText("¥5,000");
  // 金額は行の通貨で表示が変わる
  await expect(row("r1")).toContainText("¥3,600");
  await expect(row("r2")).toContainText("$49.99");
  // 開始（0 時からの分）
  await expect(row("r1")).toContainText("09:30");
});

// ============================================================
// 並べ替え・選択肢に無い値のセル。見出しを押すたびに昇順・降順が切り替わる
// ============================================================
test.describe("並べ替えと選択肢に無い値", () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, "tableView", "表（AutoTable）");
    await expect(page.getByRole("table")).toBeVisible();
    // 行が出そろってから始める
    await expect.poll(() => rowIds(page)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  /** 表の行の ID を、上から順に読む */
  async function rowIds(page: Page) {
    return page
      .getByRole("table")
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.map((row) => row.querySelector("td")?.textContent?.trim() ?? ""),
      );
  }

  const sortBy = async (page: Page, label: string) => {
    await page.getByRole("button", { name: `${label}を並び替え` }).click();
  };

  const row = (page: Page, id: string) =>
    page.getByRole("table").locator("tbody tr").filter({ hasText: id });

  for (const c of [
    // 数は値で並べる
    { label: "数量", asc: ["r4", "r1", "r2", "r3"] },
    // 日付は値で並べる
    { label: "期限", asc: ["r2", "r4", "r1", "r3"] },
  ] as const) {
    test(`${c.label}の列は値で並べる（昇順・降順）`, async ({
      page,
      pageErrors: _,
    }) => {
      await sortBy(page, c.label);
      await expect.poll(() => rowIds(page)).toEqual(c.asc);
      await sortBy(page, c.label);
      await expect.poll(() => rowIds(page)).toEqual([...c.asc].reverse());
    });
  }

  test("select（enum）の列は選択肢を定義した順に並べ、選択肢に無い値は最後", async ({
    page,
    pageErrors: _,
  }) => {
    // 未着手（r3）・対応中（r1）・完了（r2）の順。r4 は選択肢に無い
    await sortBy(page, "状態（valueAction）");
    await expect.poll(() => rowIds(page)).toEqual(["r3", "r1", "r2", "r4"]);
    await sortBy(page, "状態（valueAction）");
    await expect.poll(() => rowIds(page)).toEqual(["r2", "r1", "r3", "r4"]);
  });

  test("computed の列は計算した値で並べる（文字の値なので文字の順）", async ({
    page,
    pageErrors: _,
  }) => {
    // 小計は単価 × 数量を文字で返す："¥3,600"・"¥5,000"・"¥2,000"・"¥10,000"
    await sortBy(page, "小計（computed）");
    await expect.poll(() => rowIds(page)).toEqual(["r4", "r3", "r1", "r2"]);
    await sortBy(page, "小計（computed）");
    await expect.poll(() => rowIds(page)).toEqual(["r2", "r1", "r3", "r4"]);
  });

  test("dynamic の列は並べ替えの印が出ず、見出しを押しても順が変わらない", async ({
    page,
    pageErrors: _,
  }) => {
    const before = await rowIds(page);
    await expect(
      page.getByRole("button", { name: "金額（dynamic）を並び替え" }),
    ).toHaveCount(0);
    await page
      .getByRole("table")
      .locator("thead th")
      .filter({ hasText: "金額" })
      .click();
    expect(await rowIds(page)).toEqual(before);
  });

  test("dynamic のセルは行の通貨で表示が変わる", async ({
    page,
    pageErrors: _,
  }) => {
    await expect(row(page, "r1")).toContainText("¥3,600");
    await expect(row(page, "r2")).toContainText("$49.99");
  });

  test("選択肢に無い値のセルは、生の値ではなく「（不正な値）」と出す", async ({
    page,
    pageErrors: _,
  }) => {
    // r4 は状態（select）と担当（externalKey）に、選択肢に無い値を持つ
    const cells = row(page, "r4").locator("td");
    await expect(cells.filter({ hasText: "（不正な値）" })).toHaveCount(2);
    await expect(row(page, "r4")).not.toContainText("archived");
    await expect(row(page, "r4")).not.toContainText("u-999");
    // 選択肢にある値は、これまでどおりラベルで出す
    await expect(row(page, "r2")).toContainText("完了");
    await expect(row(page, "r2")).not.toContainText("（不正な値）");
  });

  test("z.iso.date の期限のセルは、- ではなく日付で出す", async ({
    page,
    pageErrors: _,
  }) => {
    await expect(row(page, "r1")).toContainText("2026-04-10");
    await expect(row(page, "r2")).toContainText("2026-04-01");
  });
});
