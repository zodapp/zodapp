import type { Locator } from "@playwright/test";

import { expect, openDemo, submit, test } from "./helpers";

// zf.object（並べ方）：横並びは欄の上端でそろう。エラーが出ても、並んだ欄の位置はずれない
test.beforeEach(async ({ page }) => {
  await openDemo(page, "objectLayout", "zf.object（並べ方）");
});

const top = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("要素が見えない");
  return box.y;
};

test("横並び：エラーが出ても、ラベル・入力欄・エラーの上端がそろう", async ({
  page,
  pageErrors: _,
}) => {
  // 横並びの入れ物（ラベルを含む InputWrapper のうち、いちばん内側のもの）
  const section = page
    .locator(".mantine-InputWrapper-root", {
      has: page.getByText("横並びのエラー（送信するとエラーが出る）", {
        exact: true,
      }),
    })
    .last();
  const keyword = section.getByRole("textbox", { name: /^キーワード/ });
  const from = section.getByRole("textbox", { name: /^開始/ });
  const to = section.getByRole("textbox", { name: /^終了/ });
  const checkbox = section.getByRole("checkbox", { name: "有効のみ" });

  await submit(page);
  const errors = section.locator(".mantine-InputWrapper-error");
  await expect(errors).toHaveCount(2);

  // 入力欄の上端：エラーの出た欄（キーワード・終了）と出ていない欄（開始）がそろう。
  // 開始・終了はラベルの無い入れ子 object の中にあるが、外の欄と同じ高さに並ぶ
  const keywordTop = await top(keyword);
  expect(Math.abs((await top(from)) - keywordTop)).toBeLessThanOrEqual(1);
  expect(Math.abs((await top(to)) - keywordTop)).toBeLessThanOrEqual(1);

  // エラーの上端もそろう
  const [first, second] = [await top(errors.nth(0)), await top(errors.nth(1))];
  expect(Math.abs(first - second)).toBeLessThanOrEqual(1);

  // ラベル付きの object で包んだチェックボックスは、入力欄の高さの中に来る
  const input = await keyword.boundingBox();
  const box = await checkbox.boundingBox();
  if (!input || !box) throw new Error("要素が見えない");
  const center = box.y + box.height / 2;
  expect(center).toBeGreaterThan(input.y);
  expect(center).toBeLessThan(input.y + input.height);
});
