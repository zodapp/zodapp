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
