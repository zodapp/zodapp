// @vitest-environment jsdom
/**
 * uiType: entries-horizontal：entries と同じ動きで、行をカードにして横一列に並べる
 */
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";
import { ENTRY_DEFAULT_WIDTH, entryWidthOf } from "./entries_layout";

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const price = zf
  .object({
    min: zf.number().register(zf.number.registry, { label: "以上" }).optional(),
    max: zf.number().register(zf.number.registry, { label: "以下" }).optional(),
  })
  .register(zf.object.registry, { label: "価格", uiType: "horizontal" });

const conditionSchema = z.object({
  condition: zf
    .object({
      keyword: text("キーワード"),
      title: text("タイトル").optional(),
      author: zf
        .string()
        .register(zf.string.registry, { label: "著者", width: 400 })
        .optional(),
      price: price.optional(),
    })
    .register(zf.object.registry, {
      label: "検索条件",
      uiType: "entries-horizontal",
    }),
});

const card = (name: string) => screen.getByRole("group", { name });

const scroller = () =>
  document.querySelector("[data-entries-scroller]") as HTMLElement;

const ADD = /項目を追加|Add a field/;

const addField = async (name: string) => {
  const input = screen.getByRole("combobox", { name: ADD });
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name, hidden: true }));
};

describe("カードの幅（entryWidthOf）", () => {
  it("meta の width があればそれ（.optional() の内側の meta も見る）。重みは widthWeight、無ければ幅", () => {
    expect(
      entryWidthOf(
        zf.string().register(zf.string.registry, { width: 400 }).optional(),
      ),
    ).toEqual({ width: 400, widthWeight: 400 });
    expect(
      entryWidthOf(
        zf
          .string()
          .register(zf.string.registry, { width: 400, widthWeight: 2 }),
      ),
    ).toEqual({ width: 400, widthWeight: 2 });
  });

  it("width が無ければ既定の幅", () => {
    expect(entryWidthOf(zf.string()).width).toBe(ENTRY_DEFAULT_WIDTH);
  });

  it("横並びの object は中の欄の幅の合計＋間、それ以外の object は中の欄の最大", () => {
    expect(entryWidthOf(price.optional()).width).toBe(
      ENTRY_DEFAULT_WIDTH * 2 + 8,
    );
    const vertical = zf.object({
      a: zf.string(),
      b: zf.string().register(zf.string.registry, { width: 350 }),
    });
    expect(entryWidthOf(vertical).width).toBe(350);
  });

  it("transform を付けた object も、pipe の入口を見て決める", () => {
    expect(
      entryWidthOf(price.transform((value) => value).optional()).width,
    ).toBe(ENTRY_DEFAULT_WIDTH * 2 + 8);
  });
});

describe("object（uiType: entries-horizontal）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("カードを横に並べる並びに入れ、幅は meta の width（無ければ既定）。「項目を追加」は並びの外", async () => {
    renderForm(conditionSchema, {
      condition: { keyword: "zod", author: "a" },
    });
    await ready();
    const cards = within(scroller()).getAllByRole("group");
    expect(cards.map((c) => c.getAttribute("data-entry-key"))).toEqual([
      "keyword",
      "author",
    ]);
    expect(card("キーワード").style.width).toBe(`${ENTRY_DEFAULT_WIDTH}px`);
    expect(card("著者").style.width).toBe("400px");
    expect(
      within(scroller()).queryByRole("combobox", { name: ADD }),
    ).toBeNull();
    expect(screen.getByRole("combobox", { name: ADD })).toBeTruthy();
  });

  it("⊖ は optional のカードだけにあり、押すとキーごと消える", async () => {
    const { values } = renderForm(conditionSchema, {
      condition: { keyword: "zod", title: "t" },
    });
    await ready();
    expect(within(card("キーワード")).queryByRole("button")).toBeNull();
    fireEvent.click(
      within(card("タイトル")).getByRole("button", {
        name: /タイトルを削除|Remove タイトル/,
      }),
    );
    await waitFor(() => expect(values().condition).toEqual({ keyword: "zod" }));
  });

  it("足すとカードが増え、足したカードまでスクロールする", async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { values } = renderForm(conditionSchema, {
      condition: { keyword: "zod" },
    });
    await ready();
    await addField("価格");
    await waitFor(() =>
      expect((values().condition as { price?: unknown }).price).toEqual({}),
    );
    await waitFor(() => expect(card("価格")).toBeTruthy());
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.contexts[0]).toBe(card("価格"));
    expect(card("価格").style.width).toBe(`${ENTRY_DEFAULT_WIDTH * 2 + 8}px`);
  });

  it("readOnly では、⊖ も「項目を追加」も出さない", async () => {
    renderForm(
      conditionSchema,
      { condition: { keyword: "zod", title: "t" } },
      { readOnly: true },
    );
    await ready();
    expect(screen.queryByRole("combobox", { name: ADD })).toBeNull();
    expect(screen.queryByRole("button", { name: /削除|Remove/ })).toBeNull();
  });
});

describe("partialRecord（uiType: entries-horizontal）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("値にあるキーだけをカードで横に並べ、足す・消すができる", async () => {
    const schema = z.object({
      scores: z
        .partialRecord(
          zf.enum([
            zf.literal("math").register(zf.literal.registry, { label: "数学" }),
            zf.literal("art").register(zf.literal.registry, { label: "美術" }),
          ]),
          zf.number().register(zf.number.registry, { width: 200 }),
        )
        .register(zf.record.registry, {
          label: "点数",
          uiType: "entries-horizontal",
        }),
    });
    const { values } = renderForm(schema, { scores: { math: 80 } });
    await ready();
    expect(within(scroller()).getAllByRole("group")).toHaveLength(1);
    expect(card("数学").style.width).toBe("200px");
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /キーを追加|Add a key/ }),
      ).toBeTruthy(),
    );
    const input = screen.getByRole("combobox", {
      name: /キーを追加|Add a key/,
    });
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", { name: "美術", hidden: true }),
    );
    await waitFor(() => expect(card("美術")).toBeTruthy());
    fireEvent.click(
      within(card("数学")).getByRole("button", {
        name: /数学を削除|Remove 数学/,
      }),
    );
    await waitFor(() =>
      expect(Object.keys(values().scores as object)).toEqual(["art"]),
    );
  });
});
