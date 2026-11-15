import { choose, expect, field, openDemo, previewValue, test } from "./helpers";

// zf.dynamic（読み込み・購読・連動）
test.beforeEach(async ({ page }) => {
  await openDemo(page, "dynamicAdvanced", "zf.dynamic（読み込み・購読・連動）");
  await expect(field(page, "支払期限")).toBeVisible();
});

test("帳票の種類を変えると、その種類の項目を読み込んで出す", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "帳票の種類", "領収書");
  await expect(page.getByText("読み込み中").first()).toBeVisible();
  await expect(field(page, "宛名")).toBeVisible();
  await expect(field(page, "支払期限")).toHaveCount(0);
});

test("読み込みに失敗すると再試行のボタンが出て、再試行で戻る", async ({
  page,
  pageErrors: _,
}) => {
  const failure = page.getByRole("switch", { name: /取得を失敗させる/ });
  await failure.check({ force: true });
  await choose(page, "帳票の種類", "領収書");
  const retry = page.getByRole("button", { name: "再試行" });
  await expect(retry).toBeVisible();

  await failure.uncheck({ force: true });
  await retry.click();
  await expect(field(page, "宛名")).toBeVisible();
});

test("都道府県を変えると、選択肢に無くなった下の欄を順に消す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "市区町村")).toHaveValue("新宿区");
  await choose(page, "都道府県", "大阪府");
  await expect
    .poll(async () => (await previewValue(page)).city)
    .toBeUndefined();
  await expect
    .poll(async () => (await previewValue(page)).town)
    .toBeUndefined();
  expect((await previewValue(page)).prefecture).toBe("osaka");
});

test("都道府県を消すと、市区町村・町名は選択肢が0件になり、理由を出して選べなくなる。必須エラーは出さない", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "市区町村")).toHaveValue("新宿区");
  // 都道府県の × で消す
  await field(page, "都道府県")
    .locator("xpath=ancestor::div[contains(@class,'mantine-InputWrapper-root')][1]")
    .locator("button")
    .first()
    .click();
  await expect
    .poll(async () => (await previewValue(page)).prefecture)
    .toBeUndefined();
  await expect
    .poll(async () => (await previewValue(page)).city)
    .toBeUndefined();
  await expect
    .poll(async () => (await previewValue(page)).town)
    .toBeUndefined();
  await expect(field(page, "市区町村")).toBeDisabled();
  await expect(field(page, "市区町村")).toHaveAttribute(
    "placeholder",
    "先に都道府県を選んでください",
  );
  await expect(field(page, "町名")).toHaveAttribute(
    "placeholder",
    "先に市区町村を選んでください",
  );
});
