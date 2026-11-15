import { expect, test } from "./helpers";

// サイドバーのすべてのデモページが開け、見出しが出て、例外が起きない
test("すべてのデモページが開ける", async ({ page }) => {
  await page.goto("/form/detail?formId=basicInput");
  const links = page.locator('a[href*="formId="]');
  await expect(links.first()).toBeVisible();
  const hrefs = [
    ...new Set(
      await links.evaluateAll((as) =>
        as.map((a) => a.getAttribute("href") ?? ""),
      ),
    ),
  ];
  expect(hrefs.length).toBeGreaterThan(30);

  for (const href of hrefs) {
    await test.step(href, async () => {
      await page.goto(href);
      await expect(
        page
          .getByRole("heading", { level: 2 })
          .or(page.getByRole("heading", { level: 1 }))
          .first(),
      ).toBeVisible();
    });
  }
});

// e2e 用のデモページ（メニューに出さない）も、すべて開け、例外が起きない。
// サイドバーからはたどれないので、登録簿の formId を dev サーバーから読む
test("e2e 用のデモページがすべて開ける", async ({ page }) => {
  await page.goto("/form/detail?formId=basicInput");
  const formIds = await page.evaluate(async () => {
    const path = "/src/pages/form/schemas/e2e/index.ts";
    const registry = (await import(/* @vite-ignore */ path)) as {
      e2eSchemas: Record<string, { title: string }>;
    };
    return Object.entries(registry.e2eSchemas).map(([formId, def]) => ({
      formId,
      title: def.title,
    }));
  });
  for (const { formId, title } of formIds) {
    expect(formId).toMatch(/^e2e-/);
    await test.step(formId, async () => {
      await page.goto(`/form/detail?formId=${formId}`);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      // サイドバーには出さない
      await expect(page.locator(`a[href*="formId=${formId}"]`)).toHaveCount(0);
    });
  }
});
