import { choose, expect, field, openDemo, previewValue, test } from "./helpers";

// zf.externalKey：一覧から選ぶ
test.beforeEach(async ({ page }) => {
  await openDemo(page, "selectAndExternalKey", "zf.externalKey");
});

test("一覧が届くと、保存している値をラベルで出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "externalKey（既定")).toHaveValue("山田 太郎");
});

test("allowUnlisted の欄は、一覧に無い値もそのまま持つ", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "externalKey（既定")).toHaveValue("山田 太郎");
  expect((await previewValue(page)).assigneeFree).toBe("u-999");
});

test("都道府県を変えると、新しい一覧に無い市区町村が消える", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "市区町村")).toHaveValue("新宿区");
  await choose(page, "都道府県", "大阪府");
  await expect
    .poll(async () => (await previewValue(page)).city)
    .toBeUndefined();
  expect((await previewValue(page)).prefecture).toBe("osaka");
});
