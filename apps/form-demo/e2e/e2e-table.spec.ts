import type { Page } from "@playwright/test";
import { expect, openDemo, test } from "./helpers";

// e2e：表（/form/detail?formId=e2e-table）
const TITLE = "e2e：表";

test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-table", TITLE);
  await expect(page.getByRole("table")).toBeVisible();
  // 行が出そろってから始める
  await expect.poll(() => rowIds(page)).toEqual(["t1", "t2", "t3", "t4"]);
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
  { label: "数量", asc: ["t4", "t1", "t3", "t2"] },
  // 日付は値で並べる
  { label: "期限", asc: ["t2", "t4", "t1", "t3"] },
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
  // 未着手（t2）・対応中（t3）・完了（t1）の順。t4 は選択肢に無い
  await sortBy(page, "状態");
  await expect.poll(() => rowIds(page)).toEqual(["t2", "t3", "t1", "t4"]);
  await sortBy(page, "状態");
  await expect.poll(() => rowIds(page)).toEqual(["t1", "t3", "t2", "t4"]);
});

test("computed の列は計算した値で並べる（文字の値なので文字の順）", async ({
  page,
  pageErrors: _,
}) => {
  // 小計は数量 × 100 を文字で返す："100"・"1200"・"300"・"700"
  await sortBy(page, "小計");
  await expect.poll(() => rowIds(page)).toEqual(["t4", "t2", "t1", "t3"]);
  await sortBy(page, "小計");
  await expect.poll(() => rowIds(page)).toEqual(["t3", "t1", "t2", "t4"]);
});

test("dynamic の列は並べ替えの印が出ず、見出しを押しても順が変わらない", async ({
  page,
  pageErrors: _,
}) => {
  const before = await rowIds(page);
  await expect(
    page.getByRole("button", { name: "金額を並び替え" }),
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
  await expect(row(page, "t1")).toContainText("¥3,600");
  await expect(row(page, "t2")).toContainText("$49.99");
});

test("選択肢に無い値のセルは、生の値ではなく「（不正な値）」と出す", async ({
  page,
  pageErrors: _,
}) => {
  // t4 は状態（select）と担当（externalKey）に、選択肢に無い値を持つ
  const cells = row(page, "t4").locator("td");
  await expect(cells.filter({ hasText: "（不正な値）" })).toHaveCount(2);
  await expect(row(page, "t4")).not.toContainText("archived");
  await expect(row(page, "t4")).not.toContainText("u-999");
  // 選択肢にある値は、これまでどおりラベルで出す
  await expect(row(page, "t1")).toContainText("完了");
  await expect(row(page, "t1")).not.toContainText("（不正な値）");
});

test("z.iso.date の期限のセルは、- ではなく日付で出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(row(page, "t1")).toContainText("2026-04-10");
  await expect(row(page, "t2")).toContainText("2026-04-01");
});
