import {
  choose,
  clearSelect,
  dynamicStatuses,
  fieldError,
  expect,
  field,
  formDemo,
  logOf,
  openDemo,
  pendingFetch,
  previewValue,
  setDelayMode,
  submit,
  test,
  waitSubmitSettled,
} from "./helpers";

// e2e：dynamic の読み込み・失敗・再試行・連鎖（/form/detail?formId=e2e-dynamic）
// 手順はページの説明と同じ。待ち時間ではなく、画面の状態と window.__formDemo を待つ
const TITLE = "e2e：dynamic の読み込み・失敗・再試行・連鎖";

test.beforeEach(async ({ page }) => {
  await openDemo(page, "e2e-dynamic", TITLE);
  // 開いたときの取得（見やすい遅延）が終わるまで待つ
  await expect(field(page, "支払期限")).toBeVisible();
  await expect(field(page, "町名")).toHaveValue("西新宿");
});

/** ログの件数を数えて、その後に増えた分だけを読む */
const logSince = async (page: import("@playwright/test").Page) => {
  const start = (await formDemo(page)).log.length;
  return async () => (await formDemo(page)).log.slice(start);
};

test("帳票の種類を変えると、帳票の項目だけを読み込み直して出す。ほかの欄は取り直さない", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "止めておく");
  const since = await logSince(page);

  await choose(page, "帳票の種類", "領収書");
  // 読み込み中になり、待っている取得は帳票の項目の 1 つだけ
  await expect(dynamicStatuses(page)).toHaveCount(1);
  await expect(page.getByTestId("pending-fetch")).toHaveCount(1);
  await pendingFetch(page, "load: templateFields key=receipt")
    .getByRole("button", { name: "届ける" })
    .click();
  await expect(field(page, "宛名")).toBeVisible();
  await expect(field(page, "支払期限")).toHaveCount(0);

  const events = await since();
  const fetches = events.filter((entry) => entry.type === "fetch");
  expect(fetches.filter((entry) => entry.result === "called")).toEqual([
    expect.objectContaining({
      kind: "load",
      field: "templateFields",
      key: "receipt",
    }),
  ]);
  // ほかの dynamic の欄（都道府県・市区町村・町名）は読み込み中にならない
  const labels = events
    .filter((entry) => entry.type === "dynamic-status")
    .flatMap((entry) =>
      (entry.statuses as { label: string }[]).map((status) => status.label),
    );
  expect(labels).not.toContain("都道府県");
  expect(labels).not.toContain("市区町村");
  expect(labels).not.toContain("町名");
});

test("止めておく分け方で取り直し中に送信すると、送信は止まる", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "止めておく");
  await choose(page, "帳票の種類", "領収書");
  await expect(pendingFetch(page, "templateFields")).toHaveCount(1);

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);
  expect((await logOf(page, "submit")).map((entry) => entry.result)).toEqual([
    "attempted",
    "blocked",
  ]);
  // 取り直しは止まったまま
  await expect(dynamicStatuses(page)).toHaveCount(1);
});

test("帳票の項目の取得に失敗すると「再試行」が出る。失敗をやめて再試行すると戻る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  const failure = page.getByRole("switch", { name: /取得を失敗させる/ });
  await failure.check({ force: true });
  await choose(page, "帳票の種類", "領収書");
  const retry = page.getByRole("button", { name: "再試行" });
  await expect(retry).toBeVisible();
  await expect(
    page.getByText("請求書の項目を取得できませんでした"),
  ).toHaveCount(0);

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);

  await failure.uncheck({ force: true });
  await retry.click();
  await expect(field(page, "宛名")).toBeVisible();
  await expect(retry).toHaveCount(0);
});

test("市区町村の選択肢の取得に失敗すると「再試行」が出て送信が止まる。失敗をやめて再試行すると戻る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  const failure = page.getByRole("switch", { name: /取得を失敗させる/ });
  await failure.check({ force: true });
  await choose(page, "都道府県", "大阪府");
  await expect(page.getByText("市区町村を取得できませんでした")).toBeVisible();
  const retry = page.getByRole("button", { name: "再試行" });
  await expect(retry).toHaveCount(1);
  expect(
    (await logOf(page, "fetch")).filter(
      (entry) => entry.key === "cities/osaka" && entry.result === "failed",
    ),
  ).toHaveLength(1);

  await submit(page);
  await waitSubmitSettled(page, 1);
  expect((await formDemo(page)).submitted.count).toBe(0);
  expect((await logOf(page, "submit")).at(-1)?.result).toBe("blocked");

  await failure.uncheck({ force: true });
  await retry.click();
  await expect(retry).toHaveCount(0);
  await choose(page, "市区町村", "堺市");
  await choose(page, "町名", "堺東");
  await expect
    .poll(async () => (await previewValue(page)).town)
    .toBe("sakaihigashi");
});

for (const order of ["新しい方から", "古い方から"] as const) {
  test(`止めておく分け方で種類を行き来し、${order}届けても、最後に選んだ種類の項目だけが残る`, async ({
    page,
    pageErrors: _,
  }) => {
    await setDelayMode(page, "止めておく");
    await choose(page, "帳票の種類", "領収書");
    await expect(pendingFetch(page, "key=receipt")).toHaveCount(1);
    await choose(page, "帳票の種類", "請求書");
    await expect(pendingFetch(page, "key=invoice")).toHaveCount(1);

    const names =
      order === "新しい方から"
        ? ["key=invoice", "key=receipt"]
        : ["key=receipt", "key=invoice"];
    for (const name of names) {
      await pendingFetch(page, name)
        .getByRole("button", { name: "届ける" })
        .click();
    }
    await expect(page.getByTestId("pending-fetch")).toHaveCount(0);
    await expect(field(page, "支払期限")).toBeVisible();
    await expect(field(page, "宛名")).toHaveCount(0);
    await expect(dynamicStatuses(page)).toHaveCount(0);
    expect((await previewValue(page)).template).toBe("invoice");
  });
}

test("その種類で初めて使う部品が出ても、ほかの dynamic の欄は取り直さない", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  const since = await logSince(page);
  await choose(page, "帳票の種類", "領収書");
  // 領収書だけが使う部品（再発行）が出る
  await expect(page.getByText("再発行", { exact: true })).toBeVisible();
  await expect(field(page, "町名")).toHaveValue("西新宿");

  const events = await since();
  const called = events.filter(
    (entry) => entry.type === "fetch" && entry.result === "called",
  );
  expect(called).toEqual([
    expect.objectContaining({ field: "templateFields", key: "receipt" }),
  ]);
});

for (const mode of ["すぐ届く", "1 フレーム後", "2 フレーム後"] as const) {
  test(`${mode}：都道府県を変えると市区町村・町名が順に消え、選び直した値は残る。都道府県を消すと市区町村は理由を出して無効になる`, async ({
    page,
    pageErrors: _,
  }) => {
    await setDelayMode(page, mode);
    await choose(page, "都道府県", "大阪府");
    await expect
      .poll(async () => {
        const values = await previewValue(page);
        return [values.prefecture, values.city, values.town];
      })
      .toEqual(["osaka", undefined, undefined]);

    await choose(page, "市区町村", "大阪市");
    await choose(page, "町名", "梅田");
    await expect
      .poll(async () => {
        const values = await previewValue(page);
        return [values.prefecture, values.city, values.town];
      })
      .toEqual(["osaka", "osaka-shi", "umeda"]);
    await expect(field(page, "町名")).toHaveValue("梅田");

    await clearSelect(page, "都道府県");
    await expect
      .poll(async () => {
        const values = await previewValue(page);
        return [values.prefecture, values.city, values.town];
      })
      .toEqual([undefined, undefined, undefined]);
    await expect(field(page, "市区町村")).toBeDisabled();
    await expect(field(page, "市区町村")).toHaveAttribute(
      "placeholder",
      "先に都道府県を選んでください",
    );
    // 市区町村・町名には必須のエラーを出さない
    await expect(fieldError(page, "市区町村")).toHaveCount(0);
    await expect(fieldError(page, "町名")).toHaveCount(0);
  });
}

test("外から書き込んで帳票の種類が変わっても、帳票の項目の値は削らない", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  await page
    .getByRole("button", { name: "外から書き込む（帳票の種類を切り替える）" })
    .click();
  await expect(field(page, "宛名")).toBeVisible();
  // 合わない値は残り、検証のエラーになる
  await expect
    .poll(async () => (await previewValue(page)).templateFields)
    .toEqual({ dueDate: "2026-12-31", amount: 10000 });
});

test("利用者の編集として書き込んで帳票の種類が変わると、新しい項目に合わせて値を削る", async ({
  page,
  pageErrors: _,
}) => {
  await setDelayMode(page, "すぐ届く");
  await page
    .getByRole("button", {
      name: "利用者の編集として書き込む（帳票の種類を切り替える）",
    })
    .click();
  await expect(field(page, "宛名")).toBeVisible();
  await expect
    .poll(async () => {
      const value = (await previewValue(page)).templateFields as Record<
        string,
        unknown
      >;
      return [value.dueDate, value.amount];
    })
    .toEqual([undefined, undefined]);
});
