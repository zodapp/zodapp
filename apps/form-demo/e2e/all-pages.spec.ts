import { expect, test } from "./helpers";

// サイドバーのすべてのデモページが開け、見出しが出て、例外が起きない。
// 2 ページ目からはサイドバーのリンクで移る（利用者と同じ手順）。
// page.goto で毎回読み直すと、ページが増えるにつれてテストの上限の時間に届くため
test("すべてのデモページが開ける", async ({ page }) => {
  await page.goto("/form/detail?formId=basicInput");
  const links = page.locator('a[href*="formId="]');
  await expect(links.first()).toBeVisible();
  const entries = await links.evaluateAll((as) =>
    as.map((a) => ({
      href: a.getAttribute("href") ?? "",
      title: (a.textContent ?? "").trim(),
    })),
  );
  const pages = [...new Map(entries.map((e) => [e.href, e])).values()];
  expect(pages.length).toBeGreaterThan(30);

  for (const { href, title } of pages) {
    await test.step(href, async () => {
      await page.locator(`a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(href);
      // 移った先のページの見出し（リンクと同じ名前）が出る
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
    });
  }
});

// e2e 用のページ（メニューに出さない）も、すべて開け、例外が起きない。
// サイドバーからはたどれないので、登録簿の formId を dev サーバーから読む
test("e2e 用のページがすべて開ける", async ({ page }) => {
  await page.goto("/form/detail?formId=basicInput");
  const formIds = await page.evaluate(async () => {
    const path = "/src/pages/form/schemas/e2e/index.ts";
    const registry = (await import(/* @vite-ignore */ path)) as {
      e2eSchemas: Record<string, { title: string }>;
    };
    // title は辞書のキー（msgKey）。画面の既定の言語（ja）の辞書で引く
    const dictionaryPath = "/src/messages/ja.ts";
    const { ja } = (await import(/* @vite-ignore */ dictionaryPath)) as {
      ja: Record<string, string>;
    };
    return Object.entries(registry.e2eSchemas).map(([formId, def]) => ({
      formId,
      title: ja[def.title] ?? def.title,
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
