import type { Page } from "@playwright/test";

import {
  choose,
  clearSelect,
  expect,
  field,
  fieldError,
  formDemo,
  openDemo,
  previewValue,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// zf.union（いろいろな腕）：discriminator のない union に、プリミティブ・オブジェクトなどの腕を混ぜたページ
test.beforeEach(async ({ page }) => {
  await openDemo(page, "unionArms", "zf.union（いろいろな腕）");
});

/** union の枠（Fieldset。legend が union のラベル） */
const unionGroup = (page: Page, label: string) =>
  page.getByRole("group", { name: label, exact: true });

/**
 * 腕の欄（プリミティブの腕はラベルなしで描かれるので、枠の中の最後の入力欄を取る）。
 * 腕を選ぶ欄と選択肢の腕（enum）は combobox、文字列・数値の腕は textbox
 */
const armInput = (page: Page, label: string) => {
  const group = unionGroup(page, label);
  return group.getByRole("textbox").or(group.getByRole("combobox")).last();
};

const VALUE = "値（文字列・数値・オブジェクト）";
const CODE = "番号（文字列か数値）";
const SIZE = "サイズ（選ぶか、自由に書く）";
const ANSWER = "回答（真偽値・literal・文字列）";

const valueOf = async (page: Page, key: string) =>
  (await previewValue(page))[key];

test.describe("文字列・数値・オブジェクトの腕", () => {
  test("文字列 → 数値 → オブジェクト → 文字列 → 数値と切り替え、値は腕の型で書く", async ({
    page,
    pageErrors: _,
  }) => {
    await expect(field(page, "値の種類")).toHaveValue("文字列");
    await expect(armInput(page, VALUE)).toHaveValue("こんにちは");

    // 数値：今の値は数値の腕に通らないので空になる。打つと number で書く
    await choose(page, "値の種類", "数値");
    await expect(field(page, "値の種類")).toHaveValue("数値");
    await expect(armInput(page, VALUE)).toHaveValue("");
    await armInput(page, VALUE).fill("15");
    await expect.poll(() => valueOf(page, "value")).toBe(15);

    // オブジェクト：本文の欄が出る
    await choose(page, "値の種類", "オブジェクト");
    await expect(field(page, "値の種類")).toHaveValue("オブジェクト");
    await unionGroup(page, VALUE)
      .getByRole("textbox", { name: "本文", exact: true })
      .fill("オブジェクトの本文");
    await expect
      .poll(() => valueOf(page, "value"))
      .toEqual({ text: "オブジェクトの本文" });

    // 文字列に戻す：本文の欄は消え、文字列で書く
    await choose(page, "値の種類", "文字列");
    await expect(field(page, "値の種類")).toHaveValue("文字列");
    await expect(
      unionGroup(page, VALUE).getByRole("textbox", { name: "本文" }),
    ).toHaveCount(0);
    await armInput(page, VALUE).fill("123");
    await expect.poll(() => valueOf(page, "value")).toBe("123");

    // 数字だけの文字列でも、数値の腕に切り替えて打ち直すと number になる
    await choose(page, "値の種類", "数値");
    await expect(field(page, "値の種類")).toHaveValue("数値");
    await armInput(page, VALUE).fill("20");
    await expect.poll(() => valueOf(page, "value")).toBe(20);
    await expect(field(page, "値の種類")).toHaveValue("数値");
  });

  test("送信のエラーは、選んだ腕の欄に出る", async ({
    page,
    pageErrors: _,
  }) => {
    // 文字列の腕
    await armInput(page, VALUE).fill("ab");
    await submit(page);
    await waitSubmitSettled(page, 1);
    await expect(
      unionGroup(page, VALUE).getByText("3文字以上で入力してください"),
    ).toBeVisible();
    await expect(field(page, "値の種類")).toHaveValue("文字列");

    // 数値の腕
    await choose(page, "値の種類", "数値");
    await armInput(page, VALUE).fill("7");
    await submit(page);
    await waitSubmitSettled(page, 2);
    await expect(
      unionGroup(page, VALUE).getByText("5の倍数で入力してください"),
    ).toBeVisible();
    await expect(field(page, "値の種類")).toHaveValue("数値");

    // オブジェクトの腕：本文の欄に出る
    await choose(page, "値の種類", "オブジェクト");
    await unionGroup(page, VALUE)
      .getByRole("textbox", { name: "本文", exact: true })
      .fill("ab");
    await submit(page);
    await waitSubmitSettled(page, 3);
    await expect(
      fieldError(page, "本文").filter({
        hasText: "本文は3文字以上で入力してください",
      }),
    ).toBeVisible();
    await expect(field(page, "値の種類")).toHaveValue("オブジェクト");
  });

  test("どの腕にも型が合わない値（空の数値の腕）のエラーは、選んだ腕の欄に出る", async ({
    page,
    pageErrors: _,
  }) => {
    // 数値の腕を選んで空のまま送信する。空の値は、文字列・数値・オブジェクトのどの腕にも型が合わない
    await choose(page, "値の種類", "数値");
    await expect(armInput(page, VALUE)).toHaveValue("");
    await submit(page);
    await waitSubmitSettled(page, 1);
    await expect(
      unionGroup(page, VALUE).getByText("必ず入力してください。"),
    ).toBeVisible();
    await expect(field(page, "値の種類")).toHaveValue("数値");
    expect((await formDemo(page)).submitted.count).toBe(0);

    // 数値を打つと、エラーは消える
    await armInput(page, VALUE).fill("15");
    await expect.poll(() => valueOf(page, "value")).toBe(15);
    await expect(
      unionGroup(page, VALUE).getByText("必ず入力してください。"),
    ).toHaveCount(0);
  });

  test("値を外から書き換えると、腕の選択が値に追う", async ({
    page,
    pageErrors: _,
  }) => {
    await page
      .getByRole("button", { name: "外から書き込む（値を数値の 10 にする）" })
      .click();
    await expect(field(page, "値の種類")).toHaveValue("数値");
    await expect(armInput(page, VALUE)).toHaveValue("10");

    await page
      .getByRole("button", { name: "外から書き込む（値をオブジェクトにする）" })
      .click();
    await expect(field(page, "値の種類")).toHaveValue("オブジェクト");
    await expect(
      unionGroup(page, VALUE).getByRole("textbox", {
        name: "本文",
        exact: true,
      }),
    ).toHaveValue("外から書いた本文");

    await page
      .getByRole("button", { name: "外から書き込む（値を文字列にする）" })
      .click();
    await expect(field(page, "値の種類")).toHaveValue("文字列");
    await expect(armInput(page, VALUE)).toHaveValue("外から書いた文字列");
    expect(await valueOf(page, "value")).toBe("外から書いた文字列");
  });
});

test("数字だけの文字列は文字列の腕で開き、打ち込んでも文字列のまま。数値の腕では number で書く", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "番号の書き方")).toHaveValue("文字列として書く");
  await expect(armInput(page, CODE)).toHaveValue("42");

  await armInput(page, CODE).fill("4242");
  await expect.poll(() => valueOf(page, "code")).toBe("4242");
  await expect(field(page, "番号の書き方")).toHaveValue("文字列として書く");

  // "4242" は数値の腕に通らないので、切り替えると空になる
  await choose(page, "番号の書き方", "数値として書く");
  await expect(armInput(page, CODE)).toHaveValue("");
  await armInput(page, CODE).fill("4242");
  await expect.poll(() => valueOf(page, "code")).toBe(4242);
  await expect(field(page, "番号の書き方")).toHaveValue("数値として書く");
});

test("どちらの腕にも通る値は先の腕で開き、別の腕を選んで同じ値を書いても、選んだ腕のまま", async ({
  page,
  pageErrors: _,
}) => {
  // "M" は「選ぶ」にも「自由に書く」にも通る。先の腕（選ぶ）で開く
  await expect(field(page, "サイズの決め方")).toHaveValue("選ぶ");
  await expect(armInput(page, SIZE)).toHaveValue("M");

  // 「自由に書く」を選ぶ。"M" は自由に書くにも通るので、値はそのまま
  await choose(page, "サイズの決め方", "自由に書く");
  await expect(field(page, "サイズの決め方")).toHaveValue("自由に書く");
  await expect(armInput(page, SIZE)).toHaveValue("M");

  await armInput(page, SIZE).fill("L");
  await expect.poll(() => valueOf(page, "size")).toBe("L");
  await expect(field(page, "サイズの決め方")).toHaveValue("自由に書く");

  await armInput(page, SIZE).fill("XXL");
  await expect.poll(() => valueOf(page, "size")).toBe("XXL");

  // 「選ぶ」に戻す："XXL" は選択肢に無いので空になる。選ぶと enum の値で書く
  await choose(page, "サイズの決め方", "選ぶ");
  await expect(field(page, "サイズの決め方")).toHaveValue("選ぶ");
  await expect(armInput(page, SIZE)).toHaveValue("");
  await armInput(page, SIZE).click();
  await page.getByRole("option", { name: "S", exact: true }).click();
  await expect.poll(() => valueOf(page, "size")).toBe("S");
  await expect(field(page, "サイズの決め方")).toHaveValue("選ぶ");
});

test("真偽値・literal・文字列の腕を切り替える", async ({
  page,
  pageErrors: _,
}) => {
  const answerSwitch = unionGroup(page, ANSWER).getByRole("switch");
  await expect(field(page, "回答のしかた")).toHaveValue("はい・いいえ");
  await expect(answerSwitch).toBeChecked();

  // literal：値はその literal
  await choose(page, "回答のしかた", "わからない");
  await expect(field(page, "回答のしかた")).toHaveValue("わからない");
  await expect.poll(() => valueOf(page, "answer")).toBe("unknown");
  await expect(unionGroup(page, ANSWER).getByText("unknown")).toBeVisible();

  // 文字列
  await choose(page, "回答のしかた", "その他（自由に書く）");
  await armInput(page, ANSWER).fill("たぶん");
  await expect.poll(() => valueOf(page, "answer")).toBe("たぶん");

  // 真偽値：スイッチを入れると true、切ると false
  await choose(page, "回答のしかた", "はい・いいえ");
  await expect(field(page, "回答のしかた")).toHaveValue("はい・いいえ");
  await answerSwitch.click({ force: true });
  await expect.poll(() => valueOf(page, "answer")).toBe(true);
  await answerSwitch.click({ force: true });
  await expect.poll(() => valueOf(page, "answer")).toBe(false);
  await expect(field(page, "回答のしかた")).toHaveValue("はい・いいえ");
});

test("optional・nullable の union は、空のままなら送信してもその欄にエラーを出さない。必須の union は、開いただけではエラーを出さず、送信で腕を選ぶ欄にエラーを出す", async ({
  page,
  pageErrors: _,
}) => {
  await expect(field(page, "メモの種類")).toHaveValue("");
  await expect(field(page, "備考の種類")).toHaveValue("");
  await expect(field(page, "必須の値の種類")).toHaveValue("");
  expect((await formDemo(page)).errors.fields).toEqual({});
  await expect(page.locator(".mantine-InputWrapper-error")).toHaveCount(0);

  await submit(page);
  await waitSubmitSettled(page, 1);
  const { fields } = (await formDemo(page)).errors;
  expect(fields.memo).toBeUndefined();
  expect(fields.note).toBeUndefined();
  // 必須の union は送信を止め、腕を選ぶ欄にエラーを出す
  expect(fields.required).toBeDefined();
  expect((await formDemo(page)).submitted.count).toBe(0);
  await expect(fieldError(page, "必須の値の種類")).toHaveText(
    "選択してください",
  );
  await expect(fieldError(page, "メモの種類")).toHaveCount(0);
  await expect(fieldError(page, "備考の種類")).toHaveCount(0);

  // 腕を選ぶと、腕を選ぶ欄のエラーは消える
  await choose(page, "必須の値の種類", "文字");
  await expect(fieldError(page, "必須の値の種類")).toHaveCount(0);
});

test("optional・nullable の union で腕を選び、値を書ける", async ({
  page,
  pageErrors: _,
}) => {
  await choose(page, "メモの種類", "数");
  await armInput(page, "メモ（optional。空のままでよい）").fill("5");
  await expect.poll(() => valueOf(page, "memo")).toBe(5);

  await choose(page, "備考の種類", "文字");
  await armInput(page, "備考（nullable。空のままでよい）").fill("備考です");
  await expect.poll(() => valueOf(page, "note")).toBe("備考です");
});

test("optional の union は、× で腕を外して空に戻せる", async ({
  page,
  pageErrors: _,
}) => {
  const MEMO = "メモ（optional。空のままでよい）";
  await choose(page, "メモの種類", "数");
  await armInput(page, MEMO).fill("5");
  await expect.poll(() => valueOf(page, "memo")).toBe(5);

  await clearSelect(page, "メモの種類");
  await expect(field(page, "メモの種類")).toHaveValue("");
  await expect(unionGroup(page, MEMO).getByRole("textbox")).toHaveCount(0);
  await expect.poll(() => valueOf(page, "memo")).toBeUndefined();

  // 空に戻した欄は、送信してもエラーにならない
  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).errors.fields.memo).toBeUndefined();
});

test("nullable の union は、腕を選んでも空なら null のまま。× で null に戻る", async ({
  page,
  pageErrors: _,
}) => {
  const NOTE = "備考（nullable。空のままでよい）";
  await choose(page, "備考の種類", "数");
  await expect(armInput(page, NOTE)).toHaveValue("");
  await expect.poll(() => valueOf(page, "note")).toBeNull();

  await armInput(page, NOTE).fill("7");
  await expect.poll(() => valueOf(page, "note")).toBe(7);

  await clearSelect(page, "備考の種類");
  await expect(field(page, "備考の種類")).toHaveValue("");
  await expect(unionGroup(page, NOTE).getByRole("textbox")).toHaveCount(0);
  await expect.poll(() => valueOf(page, "note")).toBeNull();
});

test.describe("配列の中の union", () => {
  const itemSelectors = (page: Page) =>
    page.getByRole("combobox", { name: /^項目の種類/ });
  // 追加・削除のボタンを持つ配列は、このページでは項目の欄だけ
  const addButtons = (page: Page) => page.locator(".tabler-icon-circle-plus");
  const removeButtons = (page: Page) =>
    page.locator(".tabler-icon-circle-minus");

  test("要素ごとに違う腕で開き、足した要素で腕を選べる。要素を消しても、残った要素の腕が保たれる", async ({
    page,
    pageErrors: _,
  }) => {
    await expect(itemSelectors(page)).toHaveCount(3);
    await expect(itemSelectors(page).nth(0)).toHaveValue("文字列");
    await expect(itemSelectors(page).nth(1)).toHaveValue("数値");
    await expect(itemSelectors(page).nth(2)).toHaveValue("オブジェクト");

    // 末尾に足す。足した要素は腕が未選択
    await addButtons(page).last().click();
    await expect(itemSelectors(page)).toHaveCount(4);
    await expect(itemSelectors(page).nth(3)).toHaveValue("");

    await itemSelectors(page).nth(3).click();
    await page.getByRole("option", { name: "数値", exact: true }).click();
    await expect(itemSelectors(page).nth(3)).toHaveValue("数値");
    expect((await valueOf(page, "items")) as unknown[]).toHaveLength(4);

    // 先頭（文字列）を消す。残った要素の腕は、数値・オブジェクト・数値のまま
    await removeButtons(page).first().click();
    await expect(itemSelectors(page)).toHaveCount(3);
    await expect(itemSelectors(page).nth(0)).toHaveValue("数値");
    await expect(itemSelectors(page).nth(1)).toHaveValue("オブジェクト");
    await expect(itemSelectors(page).nth(2)).toHaveValue("数値");
    await expect
      .poll(() => valueOf(page, "items"))
      .toEqual([5, { text: "メモです" }, undefined]);
  });
});

test("読み取り専用の union は、腕ごとに腕の名前と値を出す", async ({
  page,
  pageErrors: _,
}) => {
  const view = (label: string) => unionGroup(page, label);
  await expect(
    view("文字列の腕").getByText("文字列", { exact: true }),
  ).toBeVisible();
  await expect(
    view("文字列の腕").getByText("読み取り専用の文字列"),
  ).toBeVisible();
  await expect(
    view("数値の腕").getByText("数値", { exact: true }),
  ).toBeVisible();
  await expect(view("数値の腕").getByText("15", { exact: true })).toBeVisible();
  await expect(
    view("オブジェクトの腕").getByText("オブジェクト", { exact: true }),
  ).toBeVisible();
  await expect(
    view("オブジェクトの腕").getByText("読み取り専用の本文"),
  ).toBeVisible();
  await expect(
    view("真偽値の腕").getByText("はい・いいえ", { exact: true }),
  ).toBeVisible();
  await expect(view("真偽値の腕").getByRole("switch")).toBeChecked();
  await expect(view("真偽値の腕").getByRole("switch")).toBeDisabled();
  await expect(
    view("literal の腕").getByText("わからない", { exact: true }),
  ).toBeVisible();
  await expect(view("literal の腕").getByText("unknown")).toBeVisible();

  // 読み取り専用の欄には、腕を選ぶ欄も入力欄も出さない
  for (const label of [
    "文字列の腕",
    "数値の腕",
    "オブジェクトの腕",
    "真偽値の腕",
    "literal の腕",
  ]) {
    await expect(view(label).getByRole("textbox")).toHaveCount(0);
  }
});

test("初期値がどの腕にも通らないとき、literal の欄で腕を推定する。推定できなければ腕は空欄で、値は書き換えない", async ({
  page,
  pageErrors: _,
}) => {
  // true は文字列にも数値にも通らず、literal の欄も無い
  await expect(field(page, "保存値の種類")).toHaveValue("");
  await expect(
    unionGroup(
      page,
      "どの腕にも当てはまらない保存値（腕は空欄で開く）",
    ).getByRole("textbox"),
  ).toHaveCount(0);
  expect(await valueOf(page, "unknownSaved")).toBe(true);
  // 開いただけでは書き換えない
  expect((await formDemo(page)).isDirty).toBe(false);

  // { type: "amount" } は amount が無く、どの腕にも通らない。type から金額の腕を出す
  await expect(field(page, "下書きの種類")).toHaveValue("金額");
  await expect(field(page, "下書きの金額")).toBeVisible();
  await field(page, "下書きの金額").fill("300");
  await expect
    .poll(() => valueOf(page, "draft"))
    .toEqual({ type: "amount", amount: 300 });
  await expect(field(page, "下書きの種類")).toHaveValue("金額");

  // 腕が空欄のまま送信すると、どの腕にも型が合わない値のエラーを、腕を選ぶ欄に出す
  await expect(fieldError(page, "保存値の種類")).toHaveCount(0);
  await submit(page);
  await waitSubmitSettled(page, 1);
  await expect(fieldError(page, "保存値の種類")).toHaveText("選択してください");
});

test("object の腕の子の欄の型のエラーは、欄を離れずに直してもすぐ消える", async ({
  page,
  pageErrors: _,
}) => {
  const amount = field(page, "下書きの金額");
  // 金額を空にして欄を離れると、エラーが出る（空の数値は型のエラーで、union の欄の invalid_union になる）
  await amount.fill("3");
  await amount.fill("");
  await page.keyboard.press("Tab");
  await expect(fieldError(page, "下書きの金額")).toHaveText(
    "必ず入力してください。",
  );

  // 欄を離れずに直すと、すぐ消える（離れたときの検証の結果が union の欄に残らない）
  await amount.click();
  await amount.fill("300");
  await expect
    .poll(() => valueOf(page, "draft"))
    .toEqual({
      type: "amount",
      amount: 300,
    });
  await page.waitForTimeout(500);
  expect(await fieldError(page, "下書きの金額").count()).toBe(0);
  await expect(amount).toBeFocused();
});
