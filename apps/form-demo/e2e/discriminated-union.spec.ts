import {
  choose,
  expect,
  field,
  fieldError,
  openDemo,
  previewValue,
  test,
} from "./helpers";

// z.discriminatedUnion：窓口（種類どうしで共通の項目を持つ union）の腕の切り替え
const TITLE = "z.discriminatedUnion";

test.beforeEach(async ({ page }) => {
  await openDemo(page, "discriminatedUnion", TITLE);
  await expect(field(page, "住所")).toHaveValue("100 Main St");
  // 上の連絡先の欄（メール）が出そろって、窓口の欄の位置が決まるまで待つ
  await expect(page.getByLabel(/^メール/)).toHaveCount(2);
});

const desk = async (page: import("@playwright/test").Page) =>
  (await previewValue(page)).desk as Record<string, unknown>;

test("腕を切り替えると、共通の項目は残り、前の腕だけの項目は消え、新しい腕の既定の値が入る", async ({
  page,
  pageErrors: _,
}) => {
  await field(page, "名前").fill("駅前店");
  await choose(page, "窓口の種類", "オンライン");
  await expect(field(page, "URL")).toBeVisible();
  await expect.poll(async () => (await desk(page)).type).toBe("online");
  const value = await desk(page);
  // 共通の項目は残る
  expect(value.name).toBe("駅前店");
  expect(value.note).toBe("");
  // 店舗だけの項目は消える
  expect(value).not.toHaveProperty("address");
  // 新しい腕の項目は既定の値（URL は値なし）
  expect(value.url).toBeUndefined();
  await expect(field(page, "名前")).toHaveValue("駅前店");
});

test("元の腕に戻すと、前の腕だけの項目は既定の値に戻る（前の値は戻らない）", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "窓口の種類", "オンライン");
  await expect(field(page, "URL")).toBeVisible();
  await choose(page, "窓口の種類", "店舗");
  await expect(field(page, "住所")).toBeVisible();
  await expect.poll(async () => (await desk(page)).type).toBe("store");
  expect((await desk(page)).address).toBeUndefined();
  await expect(field(page, "住所")).toHaveValue("");
});

test("選ばれていない腕の選択の欄は、選択肢が変わっても消さない（描かれていないため）", async ({
  page,
  pageErrors: _,
}) => {
  // 店舗の腕のあいだ、オンラインの腕のチャネル（chat）は描かれていない
  expect((await desk(page)).channel).toBe("chat");
  await page.getByRole("button", { name: "チャットを選択肢から外す" }).click();
  await field(page, "名前").fill("本店（改）");
  await expect.poll(async () => (await desk(page)).name).toBe("本店（改）");
  expect((await desk(page)).channel).toBe("chat");
});

test("切り替えたあと、新しい腕の必須の欄は、触る前はエラーを出さない", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "窓口の種類", "オンライン");
  await expect(field(page, "URL")).toBeVisible();
  await expect(fieldError(page, "URL")).toHaveCount(0);
});
