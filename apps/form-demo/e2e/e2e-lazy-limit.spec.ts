import { expect, formDemo, openDemo, test } from "./helpers";

// e2e 用のページ：optional の付かない再帰だけが、maxDepth で止まる
test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-lazy-limit", "e2e：再帰の上限");
});

const inputWithValue = (page: import("@playwright/test").Page, value: string) =>
  page.locator(`input[value="${value}"]`);

test("optional なしの再帰は maxDepth で注記を出し、optional な再帰は全部描く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(inputWithValue(page, "c1")).toBeVisible();
  await expect(inputWithValue(page, "c2")).toBeVisible();
  await expect(inputWithValue(page, "c3")).toHaveCount(0);
  await expect(page.locator("[data-zod-form-unsupported]")).toHaveCount(1);
  await expect(page.locator("[data-zod-form-unsupported]")).toHaveText(
    /これより深い階層は表示できません/,
  );

  // 木は maxDepth: 2 でも、値のある所まで描く
  await expect(inputWithValue(page, "t4")).toBeVisible();
});

test("注記の先の値は、上の欄を編集しても消さない", async ({
  page,
  pageErrors: _,
}) => {
  await inputWithValue(page, "c1").fill("c1-edited");
  await inputWithValue(page, "t1").fill("t1-edited");
  await expect
    .poll(async () => (await formDemo(page)).values)
    .toMatchObject({
      chain: {
        name: "c1-edited",
        next: { name: "c2", next: { name: "c3", next: {} } },
      },
      tree: { name: "t1-edited", child: { child: { child: { name: "t4" } } } },
    });
});
