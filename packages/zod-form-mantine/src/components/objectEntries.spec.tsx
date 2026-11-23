// @vitest-environment jsdom
/**
 * object の uiType: entries：optional の項目は値にキーがあるときだけ行を出し、⊖ で消す。下の選択で足す
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

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const range = (label: string) =>
  zf
    .object({
      min: zf.number().register(zf.number.registry, { label: "以上" }),
      max: zf
        .number()
        .register(zf.number.registry, { label: "以下" })
        .optional(),
    })
    .register(zf.object.registry, { label, uiType: "horizontal" });

const sort = zf.enum([
  zf.literal("asc").register(zf.literal.registry, { label: "昇順" }),
  zf.literal("desc").register(zf.literal.registry, { label: "降順" }),
]);

const conditionSchema = (keyOrder?: "definition" | "value") =>
  z.object({
    condition: zf
      .object({
        keyword: text("キーワード"),
        title: text("タイトル").optional(),
        author: text("著者").optional(),
        price: range("価格").optional(),
        sort: sort.register(zf.enum.registry, { label: "並べ替え" }).optional(),
        withDefault: text("既定あり").default("既定"),
      })
      .register(zf.object.registry, {
        label: "検索条件",
        uiType: "entries",
        ...(keyOrder ? { keyOrder } : {}),
      }),
  });

const ROW_NAMES = [
  "キーワード",
  "タイトル",
  "著者",
  "価格",
  "並べ替え",
  "既定あり",
];

/** 行の名前（行は role="group" で、名前が付く。枠の Fieldset と、中の object の Fieldset は除く） */
const rowNames = () =>
  screen
    .getAllByRole("group")
    .map((group) => group.getAttribute("aria-labelledby"))
    .filter((id): id is string => id !== null)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .filter((name) => ROW_NAMES.includes(name));

const row = (name: string) => screen.getByRole("group", { name });

const ADD = /項目を追加|Add a field/;

const openAdd = () => {
  const input = screen.getByRole("combobox", { name: ADD });
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
};

const addField = async (name: string) => {
  openAdd();
  fireEvent.click(await screen.findByRole("option", { name, hidden: true }));
};

describe("object（uiType: entries）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("必須の項目と、値にある optional の項目だけを行にする。候補はまだ無い optional の項目", async () => {
    renderForm(conditionSchema(), {
      condition: { keyword: "zod", author: "a" },
    });
    await ready();
    expect(screen.getByText("検索条件")).toBeTruthy();
    expect(rowNames()).toEqual(["キーワード", "著者"]);
    openAdd();
    const options = await screen.findAllByRole("option", { hidden: true });
    // default の項目もキーが無くても通るので、足す候補になる
    expect(options.map((o) => o.textContent)).toEqual([
      "タイトル",
      "価格",
      "並べ替え",
      "既定あり",
    ]);
  });

  it("足すと既定値が入る（string は undefined、object は {}、default はその値）", async () => {
    const { values } = renderForm(conditionSchema(), {
      condition: { keyword: "zod" },
    });
    await ready();
    await addField("タイトル");
    await waitFor(() => expect(rowNames()).toContain("タイトル"));
    const condition = () => values().condition as Record<string, unknown>;
    expect("title" in condition()).toBe(true);
    expect(condition().title).toBeUndefined();

    await addField("価格");
    await waitFor(() => expect(condition().price).toEqual({}));
    await waitFor(() => expect(rowNames()).toContain("価格"));
    await addField("既定あり");
    await waitFor(() => expect(condition().withDefault).toBe("既定"));
    expect(rowNames()).toEqual(["キーワード", "タイトル", "価格", "既定あり"]);
  });

  it("⊖ でキーごと消え、候補に戻る。必須の行には ⊖ が無い", async () => {
    const { values } = renderForm(conditionSchema(), {
      condition: { keyword: "zod", title: "t", author: "a" },
    });
    await ready();
    expect(
      screen.queryByRole("button", {
        name: /キーワードを削除|Remove キーワード/,
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /タイトルを削除|Remove タイトル/ }),
    );
    await waitFor(() =>
      expect(values().condition).toEqual({ keyword: "zod", author: "a" }),
    );
    expect(rowNames()).toEqual(["キーワード", "著者"]);
    openAdd();
    const options = await screen.findAllByRole("option", { hidden: true });
    expect(options.map((o) => o.textContent)).toContain("タイトル");
  });

  it("行の上に必須の印を付けず、optional な object の行に子の ⊖・⊕ を出さない", async () => {
    renderForm(conditionSchema(), {
      condition: { keyword: "zod", price: { min: 1 } },
    });
    await ready();
    const price = row("価格");
    // 行の ⊖ だけ（子の OptionalContainer の ⊖・⊕ は出さない）
    expect(within(price).getAllByRole("button")).toHaveLength(1);
    expect(
      within(price).queryByRole("button", { name: /^(追加|Add)$/ }),
    ).toBeNull();
    // 行の名前に必須の印は無い。行の中の必須の欄（以上）には付く
    expect(
      document.getElementById(price.getAttribute("aria-labelledby")!)!
        .textContent,
    ).toBe("価格");
    expect(
      within(price).getByText("以上").parentElement?.textContent,
    ).toContain("*");
    expect(within(row("キーワード")).queryByText("*")).toBeNull();
  });

  it("optional の行の欄を空にすると undefined になり、行は残る。送信の値からは消える", async () => {
    const { values, submit, onSubmit } = renderForm(conditionSchema(), {
      condition: { keyword: "zod", title: "t" },
    });
    await ready();
    const input = within(row("タイトル")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() =>
      expect((values().condition as Record<string, unknown>).title).toBe(
        undefined,
      ),
    );
    expect("title" in (values().condition as object)).toBe(true);
    expect(rowNames()).toContain("タイトル");
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(JSON.parse(JSON.stringify(onSubmit.mock.calls[0]![0]))).toEqual({
      condition: { keyword: "zod" },
    });
  });

  it("nullish の行でも、欄を空にすると undefined（null にしない）", async () => {
    const schema = z.object({
      condition: zf
        .object({
          title: text("タイトル").nullish(),
          sort: sort
            .register(zf.enum.registry, { label: "並べ替え" })
            .nullish(),
        })
        .register(zf.object.registry, { uiType: "entries" }),
    });
    const { values } = renderForm(schema, {
      condition: { title: "t", sort: "asc" },
    });
    await ready();
    fireEvent.change(within(row("タイトル")).getByRole("textbox"), {
      target: { value: "" },
    });
    await waitFor(() =>
      expect(values().condition).toEqual({ title: undefined, sort: "asc" }),
    );
    expect("title" in (values().condition as object)).toBe(true);
    // enum の × も undefined を書く（null にしない）。行は残る
    const clear = row("並べ替え").querySelector(
      ".mantine-InputClearButton-root",
    ) as HTMLElement;
    fireEvent.click(clear);
    await waitFor(() =>
      expect(values().condition).toEqual({ title: undefined, sort: undefined }),
    );
    expect(rowNames()).toEqual(["タイトル", "並べ替え"]);
  });

  it("nullable だけの項目は常に行を出し、⊖ が無く、初めの値は null", async () => {
    const schema = z.object({
      condition: zf
        .object({ title: text("タイトル").nullable() })
        .register(zf.object.registry, { uiType: "entries" }),
    });
    const { values } = renderForm(schema, { condition: { title: null } });
    await ready();
    expect(rowNames()).toEqual(["タイトル"]);
    expect(
      screen.queryByRole("button", { name: /タイトルを削除|Remove タイトル/ }),
    ).toBeNull();
    fireEvent.change(within(row("タイトル")).getByRole("textbox"), {
      target: { value: "x" },
    });
    await waitFor(() => expect(values().condition).toEqual({ title: "x" }));
    fireEvent.change(within(row("タイトル")).getByRole("textbox"), {
      target: { value: "" },
    });
    await waitFor(() => expect(values().condition).toEqual({ title: null }));
  });

  it("defaultValues の undefined のキーで、初めから未入力の行を出す", async () => {
    renderForm(conditionSchema(), {
      condition: { keyword: "zod", author: undefined },
    });
    await ready();
    expect(rowNames()).toEqual(["キーワード", "著者"]);
  });

  it("keyOrder：既定は定義順、value は値の順（足した項目は末尾、値に無い必須の項目は後ろ）", async () => {
    const initial = { condition: { author: "a", title: "t", keyword: "k" } };
    renderForm(conditionSchema(), initial);
    await ready();
    expect(rowNames()).toEqual(["キーワード", "タイトル", "著者"]);
    cleanup();

    renderForm(conditionSchema("value"), initial);
    await ready();
    expect(rowNames()).toEqual(["著者", "タイトル", "キーワード"]);
    await addField("価格");
    await waitFor(() =>
      expect(rowNames()).toEqual(["著者", "タイトル", "キーワード", "価格"]),
    );
  });

  it("readOnly では、選択も ⊖ も出さない", async () => {
    renderForm(
      conditionSchema(),
      { condition: { keyword: "zod", title: "t" } },
      { readOnly: true },
    );
    await ready();
    expect(screen.queryByRole("combobox", { name: ADD })).toBeNull();
    expect(screen.queryByRole("button", { name: /削除|Remove/ })).toBeNull();
  });

  describe("項目の meta の readOnly", () => {
    const schema = () =>
      z.object({
        condition: zf
          .object({
            keyword: text("キーワード"),
            title: text("タイトル").optional(),
            locked: zf
              .string()
              .register(zf.string.registry, { label: "固定", readOnly: true })
              .optional(),
            open: zf
              .string()
              .register(zf.string.registry, {
                label: "編集可",
                readOnly: false,
              })
              .optional(),
          })
          .register(zf.object.registry, {
            label: "検索条件",
            uiType: "entries",
          }),
      });

    it("readOnly の行には ⊖ を出さない（ほかの optional の行には出す）", async () => {
      renderForm(schema(), {
        condition: { keyword: "zod", title: "t", locked: "x" },
      });
      await ready();
      expect(screen.getByText("x")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: /固定を削除|Remove 固定/ }),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: /タイトルを削除|Remove タイトル/ }),
      ).toBeTruthy();
    });

    it("値に無い readOnly の項目は、足す候補に出さない（readOnly: false は出す）", async () => {
      renderForm(schema(), { condition: { keyword: "zod" } });
      await ready();
      openAdd();
      const options = await screen.findAllByRole("option", { hidden: true });
      expect(options.map((o) => o.textContent)).toEqual(["タイトル", "編集可"]);
    });
  });

  it("transform を付けた object の項目も行になり、足す・消すができる", async () => {
    const isEmpty = (v: Record<string, unknown>) =>
      Object.values(v).every((x) => x === undefined);
    const schema = z.object({
      condition: zf
        .object({
          price: zf
            .object({
              min: zf
                .number()
                .register(zf.number.registry, { label: "以上" })
                .optional(),
              max: zf
                .number()
                .register(zf.number.registry, { label: "以下" })
                .optional(),
            })
            .register(zf.object.registry, { label: "価格" })
            .transform((v) => (isEmpty(v) ? undefined : v))
            .optional(),
        })
        .register(zf.object.registry, { uiType: "entries" }),
    });
    const { values } = renderForm(schema, { condition: {} });
    await ready();
    await addField("価格");
    await waitFor(() => expect(values().condition).toEqual({ price: {} }));
    expect(within(row("価格")).getByText("以上")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /価格を削除|Remove 価格/ }),
    );
    await waitFor(() => expect(values().condition).toEqual({}));
  });
});
