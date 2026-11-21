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

// 英語に切り替えると、すべてのページ（e2e 用も）から、訳していない辞書のキーと日本語の文字が消える。
// 日本語のまま残してよいのは、言語の違いを見せる値・日本の住所のサンプル・カナの読み・言語の切り替え（「日本語」）だけ。
// コードのタブは開かない（隠れたタブの中身は innerText に入らない）
const ALLOWED_JAPANESE = [
  // 言語の切り替え
  "日本語",
  // 言語の違いを見せる値（挨拶・多言語のタイトル）
  "こんにちは",
  "你好",
  "お知らせ",
  // カナの読み（日本語の名前の読みを入れる欄）
  "ヤマダ",
  "タロウ",
];

test("英語に切り替えると、すべてのページから訳していないキーと日本語が消える", async ({
  page,
  pageErrors: _,
}) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.localStorage.setItem("app-locale", JSON.stringify("en"));
  });
  await page.goto("/form/detail?formId=basicInput");
  const links = page.locator('a[href*="formId="]');
  await expect(links.first()).toBeVisible();
  const { sidebarPages, e2ePages, allowed } = await page.evaluate(
    async (fixed) => {
      const registryPath = "/src/pages/form/schemas/e2e/index.ts";
      const resolversPath = "/src/shared/demo/resolvers.tsx";
      const registry = (await import(/* @vite-ignore */ registryPath)) as {
        e2eSchemas: Record<string, { title: string }>;
      };
      const dictionaryPath = "/src/messages/en.ts";
      const { en } = (await import(/* @vite-ignore */ dictionaryPath)) as {
        en: Record<string, string>;
      };
      // 日本の住所のサンプルの選択肢（データなので、言語を切り替えても日本語のまま）
      const resolvers = (await import(
        /* @vite-ignore */ resolversPath
      )) as Record<string, unknown>;
      type Option = { label: string };
      const jpLabels = [
        ...(resolvers.prefecturesJp as Option[]),
        ...Object.values(resolvers.citiesJp as Record<string, Option[]>).flat(),
        ...Object.values(resolvers.townsJp as Record<string, Option[]>).flat(),
      ].map((option) => option.label);
      const sidebar = [
        ...document.querySelectorAll<HTMLAnchorElement>('a[href*="formId="]'),
      ].map((a) => ({
        href: a.getAttribute("href") ?? "",
        title: (a.textContent ?? "").trim(),
      }));
      return {
        sidebarPages: [...new Map(sidebar.map((e) => [e.href, e])).values()],
        e2ePages: Object.entries(registry.e2eSchemas).map(([formId, def]) => ({
          href: `/form/detail?formId=${formId}`,
          title: en[def.title] ?? def.title,
        })),
        allowed: [...fixed, ...jpLabels],
      };
    },
    ALLOWED_JAPANESE,
  );
  expect(sidebarPages.length).toBeGreaterThan(30);
  expect(e2ePages.length).toBeGreaterThan(5);

  /** 画面の文字と入力欄の値のうち、訳していないキーと、許した値を除いた日本語 */
  const leftovers = () =>
    page.evaluate((allowedTexts) => {
      const inputs = [
        ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        ),
      ]
        .filter((element) => element.type !== "hidden")
        .map((element) => element.value);
      const texts = [
        ...document.body.innerText.split("\n"),
        ...inputs,
        ...[...document.querySelectorAll("[placeholder]")].map(
          (element) => element.getAttribute("placeholder") ?? "",
        ),
      ];
      const japanese = /[぀-ヿ㐀-鿿！-｠]/;
      return texts
        .map((text) => {
          let rest = text;
          for (const allowedText of allowedTexts) {
            rest = rest.split(allowedText).join("");
          }
          return { text, rest };
        })
        .filter(
          ({ text, rest }) => /formDemo\./.test(text) || japanese.test(rest),
        )
        .map(({ text }) => text.trim());
    }, allowed);

  /** 移った先のページの見出しが出てから、選択肢や読み込みの結果が届くまで待って確かめる */
  const check = async (title: string) => {
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    // 届くまでは「Loading」などの英語
    await expect.soft.poll(leftovers, { timeout: 8_000 }).toEqual([]);
  };

  // メニューのページは、サイドバーのリンクで移る（利用者と同じ手順）。
  // page.goto で毎回読み直すと、CI では読み直しに時間がかかり、見出しを待つ時間を超えることがある
  for (const { href, title } of sidebarPages) {
    await test.step(href, async () => {
      await page.locator(`a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(href);
      await check(title);
    });
  }
  // e2e 用のページはサイドバーに無いので、URL を開く
  for (const { href, title } of e2ePages) {
    await test.step(href, async () => {
      await page.goto(href);
      await check(title);
    });
  }
});
