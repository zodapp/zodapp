import type { Locator, Page } from "@playwright/test";

import {
  expect,
  formDemo,
  openDemo,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// zf.object（uiType: entries）：使う項目だけを足す検索条件
test.beforeEach(async ({ page }) => {
  await openDemo(page, "objectEntries", "zf.object（項目を足す）");
});

/** 全体の枠（legend の名前で探す） */
const frame = (page: Page, name: string) =>
  page.getByRole("group", { name, exact: true });

const definitionFrame = (page: Page) =>
  frame(page, "検索条件（keyOrder: definition）");
const valueFrame = (page: Page) => frame(page, "検索条件（keyOrder: value）");

/** 行（行の名前で探す） */
const row = (container: Locator, name: string) =>
  container.getByRole("group", { name, exact: true });

/** 行の名前を、並んだ順に読む */
const rowNames = (container: Locator) =>
  container
    .locator('[role="group"][aria-labelledby]')
    .evaluateAll((groups) =>
      groups.map(
        (group) =>
          document.getElementById(group.getAttribute("aria-labelledby")!)
            ?.textContent ?? "",
      ),
    );

const addField = async (page: Page, container: Locator, name: string) => {
  await container.getByRole("combobox", { name: "項目を追加" }).click();
  await page.getByRole("option", { name, exact: true }).click();
};

const condition = async (page: Page) =>
  (await previewValue(page)).condition as Record<string, unknown>;

test("必須・nullable の項目と、値にある optional の項目だけが行になる。undefined のキーの行も出る", async ({
  page,
  pageErrors: _,
}) => {
  await expect
    .poll(() => rowNames(definitionFrame(page)))
    .toEqual(["キーワード", "著者", "出版社"]);
  // 必須（キーワード）と nullable（出版社）には ⊖ が無い
  await expect(
    definitionFrame(page).getByRole("button", { name: /を削除$/ }),
  ).toHaveCount(1);
  await expect(
    definitionFrame(page).getByRole("button", { name: "著者を削除" }),
  ).toBeVisible();
});

test("項目を足して入力し、⊖ で消す。足しただけの行は、送信した値に入らない", async ({
  page,
  pageErrors: _,
}) => {
  const container = definitionFrame(page);
  await addField(page, container, "タイトル");
  await expect
    .poll(() => rowNames(container))
    .toEqual(["キーワード", "タイトル", "著者", "出版社"]);
  await row(container, "タイトル").getByRole("textbox").fill("型");
  await expect.poll(() => condition(page)).toMatchObject({ title: "型" });

  // 並べ替えを足すが、選ばないまま送る
  await addField(page, container, "並べ替え");
  await expect.poll(() => rowNames(container)).toContain("並べ替え");

  await container.getByRole("button", { name: "タイトルを削除" }).click();
  await expect.poll(() => rowNames(container)).not.toContain("タイトル");
  await expect.poll(async () => "title" in (await condition(page))).toBe(false);

  await submit(page);
  await waitSubmitSettled(page, 1);
  const { submitted } = await formDemo(page);
  // 未入力の著者・並べ替えは undefined のキーなので、JSON に入らない
  expect((submitted.values as { condition: unknown }).condition).toEqual({
    keyword: "zod",
    publisher: null,
  });
});

test("transform を付けた価格は、以上・以下を両方空にすると送信した値に入らない（画面には行が残る）", async ({
  page,
  pageErrors: _,
}) => {
  const container = definitionFrame(page);
  await addField(page, container, "価格");
  const price = row(container, "価格");
  await expect(price).toBeVisible();
  // 行の ⊖ だけで、子の ⊖・⊕ は出ない
  await expect(price.getByRole("button")).toHaveCount(1);

  const min = price.getByRole("textbox").first();
  await min.fill("1000");
  await expect
    .poll(() => condition(page))
    .toMatchObject({ price: { min: 1000 } });
  await min.fill("");
  await expect.poll(() => rowNames(container)).toContain("価格");

  await submit(page);
  await waitSubmitSettled(page, 1);
  const { submitted } = await formDemo(page);
  const sent = (submitted.values as { condition: Record<string, unknown> })
    .condition;
  expect(sent).toEqual({ keyword: "zod", publisher: null });
  // transform が undefined を返すので、キーは undefined で残り、JSON には入らない
  expect(sent.price).toBeUndefined();
  expect(JSON.parse(JSON.stringify(sent))).toEqual({
    keyword: "zod",
    publisher: null,
  });
});

test("keyOrder: value では、足した項目が末尾に並ぶ", async ({
  page,
  pageErrors: _,
}) => {
  const container = valueFrame(page);
  await expect.poll(() => rowNames(container)).toEqual(["著者"]);
  await addField(page, container, "価格");
  await addField(page, container, "タイトル");
  await expect
    .poll(() => rowNames(container))
    .toEqual(["著者", "価格", "タイトル"]);
});
