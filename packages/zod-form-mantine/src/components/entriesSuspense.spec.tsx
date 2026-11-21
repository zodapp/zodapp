// @vitest-environment jsdom
/**
 * entries の行ごとの Suspense：初めて描く種類の部品の行を足しても、object 全体は loading にならない
 * （このファイルでは number・enum の部品をまだ読み込んでいない状態から始める）
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

// 種類ごとに、まだ読み込んでいない部品を使う（同じファイルの中では、一度読み込んだ部品は待たない）
const schema = (uiType: string, field: z.ZodTypeAny) =>
  z.object({
    condition: zf
      .object({
        keyword: zf
          .string()
          .register(zf.string.registry, { label: "キーワード" }),
        price: field.optional(),
      })
      .register(zf.object.registry, { label: "検索条件", uiType }),
  });

describe.each([
  {
    uiType: "entries",
    field: zf.number().register(zf.number.registry, { label: "価格" }),
  },
  {
    uiType: "entries-horizontal",
    field: zf.boolean().register(zf.boolean.registry, { label: "価格" }),
  },
])("uiType: $uiType の行ごとの Suspense", ({ uiType, field }) => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("初めての部品の行を足しても、ほかの行・名前・選択は出たまま", async () => {
    renderForm(schema(uiType, field), { condition: { keyword: "zod" } });
    await screen.findByRole("button", { name: SUBMIT_LABEL });
    const input = screen.getByRole("combobox", {
      name: /項目を追加|Add a field/,
    });
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const option = await screen.findByRole("option", {
      name: "価格",
      hidden: true,
    });
    fireEvent.click(option);
    // 足した直後（部品の読み込み中）も、枠・既存の行・足した行の名前は出ている
    expect(screen.getByRole("group", { name: "キーワード" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "価格" })).toBeTruthy();
    expect(screen.getByText("検索条件")).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "価格" }).querySelector("input"),
      ).toBeTruthy(),
    );
  });
});
