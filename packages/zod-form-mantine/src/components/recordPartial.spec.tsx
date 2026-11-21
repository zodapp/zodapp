// @vitest-environment jsdom
/**
 * キーが enum・literal の z.partialRecord：既定は固定のキー＋optional、uiType entries は下でキーを足す形
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
import { zf, getDefaultValue } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });

const people = zf.enum([
  zf.literal("alice").register(zf.literal.registry, { label: "アリス" }),
  zf.literal("bob").register(zf.literal.registry, { label: "ボブ" }),
  zf.literal("carol").register(zf.literal.registry, { label: "キャロル" }),
]);

describe("partialRecord（既定：固定のキー＋optional）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("候補のキーを label で全部並べ、入力するとキーが入り、空にするとキーごと消える", async () => {
    const schema = z.object({
      nicknames: z.partialRecord(people, z.string().min(1)),
    });
    const { values, submit, onSubmit } = renderForm(schema, {
      nicknames: { alice: "アリー" },
    });
    await ready();
    expect(screen.getByText("アリス")).toBeTruthy();
    expect(screen.getByText("ボブ")).toBeTruthy();
    expect(screen.getByText("キャロル")).toBeTruthy();
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs).toHaveLength(3);
    expect(inputs[0]!.value).toBe("アリー");

    fireEvent.change(inputs[1]!, { target: { value: "ボビー" } });
    await waitFor(() =>
      expect(values().nicknames).toEqual({ alice: "アリー", bob: "ボビー" }),
    );

    fireEvent.change(inputs[0]!, { target: { value: "" } });
    await waitFor(() => expect(values().nicknames).toEqual({ bob: "ボビー" }));
    expect(Object.keys(values().nicknames as Record<string, unknown>)).toEqual([
      "bob",
    ]);

    submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ nicknames: { bob: "ボビー" } }),
    );
  });

  it("空のまま送信でき、必須の印も必須のエラーも出さない", async () => {
    const schema = z.object({
      nicknames: z.partialRecord(people, z.string().min(1)),
    });
    const { submit, onSubmit } = renderForm(schema, getDefaultValue(schema));
    await ready();
    submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ nicknames: {} }),
    );
    expect(screen.queryByText("Required.")).toBeNull();
  });

  it("値が object なら ＋ で開き、削除でキーごと消える", async () => {
    const schema = z.object({
      profiles: z.partialRecord(
        people,
        z
          .object({ age: z.number().default(20) })
          .register(zf.object.registry, {}),
      ),
    });
    const { values, container } = renderForm(schema, { profiles: {} });
    await ready();
    const addButtons = () =>
      Array.from(container.querySelectorAll("button")).filter((b) =>
        b.querySelector(".tabler-icon-circle-plus"),
      );
    expect(addButtons()).toHaveLength(3);
    fireEvent.click(addButtons()[1]!);
    await waitFor(() =>
      expect(values().profiles).toEqual({ bob: { age: 20 } }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /削除|Remove/ }));
    await waitFor(() => expect(values().profiles).toEqual({}));
  });

  it("キーが literal の partialRecord も、キーの値を名前にして並べる", async () => {
    const schema = z.object({
      stock: z.partialRecord(z.literal(["small", "large"]), z.number()),
    });
    renderForm(schema, { stock: {} });
    await ready();
    expect(screen.getByText("small")).toBeTruthy();
    expect(screen.getByText("large")).toBeTruthy();
  });
});

describe("partialRecord（uiType entries：下でキーを足す）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const entriesSchema = (keyOrder?: "definition" | "value") =>
    z.object({
      nicknames: z
        .partialRecord(people, z.string().default("x"))
        .register(zf.record.registry, {
          label: "あだ名",
          uiType: "entries",
          ...(keyOrder ? { keyOrder } : {}),
        }),
    });

  // 行は role="group" で、行の上の名前（label 要素ではない）が付く
  const rowLabels = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[role="group"][aria-labelledby]'))
      .map(
        (group) =>
          document.getElementById(group.getAttribute("aria-labelledby")!)
            ?.textContent ?? "",
      )
      .filter((text) => ["アリス", "ボブ", "キャロル"].includes(text));

  /** 下の選択を開く（Mantine の Select は、jsdom では選択肢を隠したまま出す） */
  const openAddKey = () => {
    const input = screen.getByRole("combobox", {
      name: /キーを追加|Add a key/,
    });
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
  };

  const addKey = async (name: string) => {
    openAddKey();
    fireEvent.click(await screen.findByRole("option", { name, hidden: true }));
  };

  it("値にあるキーだけを並べ、下の選択の候補はまだ無いキーだけ。選ぶと既定値で足す", async () => {
    const { values, container } = renderForm(entriesSchema(), {
      nicknames: { bob: "ボビー" },
    });
    await ready();
    expect(rowLabels(container)).toEqual(["ボブ"]);
    openAddKey();
    const options = await screen.findAllByRole("option", { hidden: true });
    expect(options.map((o) => o.textContent)).toEqual(["アリス", "キャロル"]);
    fireEvent.click(options[1]!);
    await waitFor(() =>
      expect(values().nicknames).toEqual({ bob: "ボビー", carol: "x" }),
    );
    expect(rowLabels(container)).toEqual(["ボブ", "キャロル"]);
  });

  it("削除するとキーごと値から消え、選択の候補に戻る。使い切ると選択を出さない", async () => {
    const { values } = renderForm(entriesSchema(), {
      nicknames: { alice: "a", bob: "b" },
    });
    await ready();
    await addKey("キャロル");
    await waitFor(() =>
      expect(Object.keys(values().nicknames as object)).toHaveLength(3),
    );
    expect(
      screen.queryByRole("combobox", { name: /キーを追加|Add a key/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /ボブを削除|Remove ボブ/ }),
    );
    await waitFor(() =>
      expect(values().nicknames).toEqual({ alice: "a", carol: "x" }),
    );
    expect(
      screen.getByRole("combobox", { name: /キーを追加|Add a key/ }),
    ).toBeTruthy();
  });

  it("keyOrder：既定は定義順、value は値の順（足したキーは末尾）", async () => {
    const initial = { nicknames: { carol: "c", alice: "a" } };
    const first = renderForm(entriesSchema(), initial);
    await ready();
    expect(rowLabels(first.container)).toEqual(["アリス", "キャロル"]);
    cleanup();

    const second = renderForm(entriesSchema("value"), initial);
    await ready();
    expect(rowLabels(second.container)).toEqual(["キャロル", "アリス"]);
    await addKey("ボブ");
    await waitFor(() =>
      expect(rowLabels(second.container)).toEqual([
        "キャロル",
        "アリス",
        "ボブ",
      ]),
    );
  });

  it("readOnly では、選択も削除のボタンも出さない", async () => {
    renderForm(
      entriesSchema(),
      { nicknames: { alice: "a" } },
      { readOnly: true },
    );
    await ready();
    expect(
      screen.queryByRole("combobox", { name: /キーを追加|Add a key/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /削除|Remove/ })).toBeNull();
  });

  it("足したキーのまま送信できる", async () => {
    const { submit, onSubmit } = renderForm(entriesSchema(), {
      nicknames: {},
    });
    await ready();
    await addKey("アリス");
    submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ nicknames: { alice: "x" } }),
    );
  });

  it("行の上に必須の印を付けず、全体を枠で囲む", async () => {
    const { container } = renderForm(entriesSchema(), {
      nicknames: { alice: "a" },
    });
    await ready();
    expect(container.querySelector("fieldset")).toBeTruthy();
    expect(screen.getByText("あだ名").tagName).toBe("LEGEND");
    const row = screen.getByRole("group", { name: "アリス" });
    expect(row.textContent).not.toContain("*");
  });

  it("値が optional なら、空にした行を送れる（キーは undefined で残る）", async () => {
    const schema = z.object({
      nicknames: z
        .partialRecord(people, z.string().optional())
        .register(zf.record.registry, { uiType: "entries" }),
    });
    const { values, submit, onSubmit } = renderForm(schema, {
      nicknames: { alice: "a" },
    });
    await ready();
    fireEvent.change(
      within(screen.getByRole("group", { name: "アリス" })).getByRole(
        "textbox",
      ),
      { target: { value: "" } },
    );
    await waitFor(() =>
      expect(values().nicknames).toEqual({ alice: undefined }),
    );
    expect("alice" in (values().nicknames as object)).toBe(true);
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("値が optional でなければ、空にした行は送信でエラーになる", async () => {
    const schema = z.object({
      nicknames: z
        .partialRecord(people, z.string())
        .register(zf.record.registry, { uiType: "entries" }),
    });
    const { submit, onSubmit } = renderForm(schema, {
      nicknames: { alice: "a" },
    });
    await ready();
    fireEvent.change(
      within(screen.getByRole("group", { name: "アリス" })).getByRole(
        "textbox",
      ),
      { target: { value: "" } },
    );
    submit();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
