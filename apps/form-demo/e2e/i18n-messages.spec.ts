import { expect, field, fieldError, openDemo, submit, test } from "./helpers";

// ヘッダーの言語の切り替えで、辞書のキーで書いた meta の文言・zod のエラー・ライブラリの文言が変わる
test("en に切り替えると、ラベル・選択肢・エラーが英語になり、ja に戻せる", async ({
  page,
  pageErrors: _,
}) => {
  await openDemo(page, "i18nMessages", "i18n-messages");

  // 既定は ja
  await expect(field(page, "名前")).toBeVisible();
  await submit(page);
  await expect(fieldError(page, "名前")).toHaveText(
    "3文字以上で入力してください。",
  );
  await expect(fieldError(page, "メールアドレス")).toHaveText(
    "有効なメールアドレスを入力してください。",
  );

  // en に切り替える（選んだ言語は localStorage に残る）
  await page
    .getByTestId("language-switcher")
    .getByText("English", { exact: true })
    .click();
  await expect(field(page, "Name")).toBeVisible();
  await expect(fieldError(page, "Name")).toHaveText(
    "Enter at least 3 characters.",
  );
  await expect(fieldError(page, "Email")).toHaveText(
    "Enter a valid email address.",
  );

  // 選択肢のラベルも訳す
  await field(page, "Favorite color").click();
  await expect(
    page.getByRole("option", { name: "Green", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // 読み直しても en のまま
  await page.reload();
  await expect(field(page, "Name")).toBeVisible();

  // ja に戻す
  await page
    .getByTestId("language-switcher")
    .getByText("日本語", { exact: true })
    .click();
  await expect(field(page, "名前")).toBeVisible();
});
