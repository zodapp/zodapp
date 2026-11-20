import type { Page } from "@playwright/test";

import {
  choose,
  expect,
  field,
  openDemo,
  optionsOf,
  jpAddress,
  previewValue,
  test,
} from "./helpers";

// zf.externalKey：一覧から選ぶ
test.beforeEach(async ({ page }) => {
  await openDemo(page, "selectAndExternalKey", "zf.externalKey");
});

test("一覧が届くと、保存している値をラベルで出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "externalKey（既定")).toHaveValue("Alice Johnson");
});

test("allowUnlisted の欄は、一覧に無い値もそのまま持つ", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "externalKey（既定")).toHaveValue("Alice Johnson");
  expect((await previewValue(page)).assigneeFree).toBe("u-999");
});

test("都道府県を変えると、新しい一覧に無い市区町村が消える", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "市区町村")).toHaveValue("新宿区");
  await choose(page, "都道府県", "大阪府");
  await expect.poll(async () => (await jpAddress(page)).city).toBeUndefined();
  expect((await jpAddress(page)).prefecture).toBe("osaka");
});

// 同じ購読のまま選択肢が届き直す：画面のボタンで当番の topic を変える
const ON_DUTY = "当番（既定の clear";
const ON_DUTY_KEEP = "当番（unlisted: keep";
const UNLISTED_ERROR = "選択肢に無い値です。選び直してください。";

const redeliver = async (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).click();

test("既定（clear）の欄は、届き直した一覧から外れた値を消し、一覧が戻っても値は戻らない", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, ON_DUTY)).toHaveValue("Bob Smith");

  await redeliver(page, "Bob Smithを外して届け直す");
  await expect
    .poll(async () => (await previewValue(page)).onDuty)
    .toBeUndefined();
  await expect(field(page, ON_DUTY)).toHaveValue("");

  await redeliver(page, "全員を届け直す");
  await expect
    .poll(() => optionsOf(page, ON_DUTY))
    .toEqual(["Alice Johnson", "Bob Smith", "Carol Davis"]);
  expect((await previewValue(page)).onDuty).toBeUndefined();
  await expect(field(page, ON_DUTY)).toHaveValue("");
});

test("unlisted: keep の欄は、届き直した一覧から外れた値を残して不正な値として出し、一覧が戻れば戻る", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, ON_DUTY_KEEP)).toHaveValue("Bob Smith");

  await redeliver(page, "Bob Smithを外して届け直す");
  await expect(field(page, ON_DUTY_KEEP)).toHaveValue("（不正な値）");
  await expect(page.getByText(UNLISTED_ERROR)).toBeVisible();
  expect((await previewValue(page)).onDutyKeep).toBe("u-002");

  await redeliver(page, "全員を届け直す");
  await expect(field(page, ON_DUTY_KEEP)).toHaveValue("Bob Smith");
  await expect(page.getByText(UNLISTED_ERROR)).toBeHidden();
  expect((await previewValue(page)).onDutyKeep).toBe("u-002");
});
