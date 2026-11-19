// @vitest-environment jsdom
/**
 * キーの決まった record（#5）：列挙したキーを固定の欄として、object と同じように並べる
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf, getDefaultValue } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });

describe("キーの決まった record", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  for (const [name, make] of [
    ["z.record(z.enum)", () => z.record(z.enum(["ja", "en"]), z.string())],
    [
      "zf.record(z.literal([...]))",
      () =>
        zf
          .record(z.literal(["ja", "en"]), z.string())
          .register(zf.record.registry, { label: "名前" }),
    ],
    [
      "uiType entries でも同じ",
      () =>
        zf
          .record(z.enum(["ja", "en"]), z.string())
          .register(zf.record.registry, { uiType: "entries" }),
    ],
  ] as const) {
    it(`${name}：キーごとに欄を出し、足りないキーのエラーがその欄に出る`, async () => {
      const schema = z.object({ names: make() });
      const { submit, onSubmit } = renderForm(schema, getDefaultValue(schema));
      await ready();
      expect(screen.getByText("ja")).toBeTruthy();
      expect(screen.getByText("en")).toBeTruthy();
      // キーの追加・名前の変更はできない
      expect(screen.queryByText("Key")).toBeNull();
      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      expect(inputs).toHaveLength(2);
      fireEvent.change(inputs[0]!, { target: { value: "こんにちは" } });
      submit();
      await waitFor(() =>
        expect(screen.getAllByText("Required.").length).toBe(1),
      );
      expect(onSubmit).not.toHaveBeenCalled();
      fireEvent.change(inputs[1]!, { target: { value: "hello" } });
      submit();
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          names: { ja: "こんにちは", en: "hello" },
        }),
      );
    });
  }

  it("キーの選択肢の label を、欄の名前にする（zf.enum・literal の union）", async () => {
    const lang = zf.enum([
      zf.literal("ja").register(zf.literal.registry, { label: "日本語" }),
      zf.literal("en").register(zf.literal.registry, { label: "英語" }),
    ]);
    const size = z.union([
      zf.literal("s").register(zf.literal.registry, { label: "小" }),
      zf.literal("l").register(zf.literal.registry, { label: "大" }),
    ]);
    const schema = z.object({
      a: z.record(lang, z.string()),
      b: z.record(size, z.number()),
    });
    renderForm(schema, getDefaultValue(schema));
    await ready();
    for (const label of ["日本語", "英語", "小", "大"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("partialRecord・string のキーは、今の見た目のまま（値にあるキーだけ）", async () => {
    const schema = z.object({
      p: z.partialRecord(z.enum(["a", "b"]), z.string()),
    });
    renderForm(schema, { p: { a: "x" } });
    await ready();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});

describe("キーの検査のエラー（invalid_key）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("既定の見た目：値の欄ではなく、record の欄に、キーの検査の文言で出す", async () => {
    const { submit } = renderForm(
      z.object({
        r: z
          .record(z.string().min(2, "キーは 2 文字以上"), z.string())
          .register(zf.record.registry, { label: "辞書" }),
      }),
      { r: { a: "x" } },
    );
    await ready();
    submit();
    expect(await screen.findByText("キーは 2 文字以上")).toBeTruthy();
    expect(screen.queryByText(/Invalid key/)).toBeNull();
  });

  it("entries：そのキーの欄に出す", async () => {
    const { submit } = renderForm(
      z.object({
        r: zf
          .record(z.string().min(2, "キーは 2 文字以上"), z.string())
          .register(zf.record.registry, { label: "辞書", uiType: "entries" }),
      }),
      { r: { a: "x" } },
    );
    await ready();
    submit();
    const message = await screen.findByText("キーは 2 文字以上");
    const keyInput = screen.getByDisplayValue("a");
    expect(
      keyInput.closest(".mantine-InputWrapper-root")?.contains(message),
    ).toBe(true);
  });
});
