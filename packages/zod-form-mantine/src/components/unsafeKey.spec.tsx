// @vitest-environment jsdom
/**
 * フィールドパスに使えないキー（#6）：`.`・`[`・`]` を含むキー、空文字のキー
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });
const UNEDITABLE = "This entry cannot be edited in this form.";
const UNSAFE_NAME = "This key name cannot be used.";

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  setupDomMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const entries = (value: z.ZodTypeAny = z.string()) =>
  z.object({
    r: zf
      .record(z.string(), value)
      .register(zf.record.registry, { label: "辞書", uiType: "entries" }),
  });
const plain = (value: z.ZodTypeAny = z.string()) =>
  z.object({ r: z.record(z.string(), value) });

describe("record の entries：キーの入力", () => {
  it.each(["a.b", "a[0]", "x]"])(
    "%j はエラーにし、値に入れない",
    async (key) => {
      const { values } = renderForm(entries(), { r: {} });
      await ready();
      fireEvent.click(screen.getByRole("button", { name: "Add to the end" }));
      const keyInput = screen.getAllByRole("textbox")[0]!;
      fireEvent.change(keyInput, { target: { value: key } });
      expect(
        await screen.findByText('Keys cannot contain ".", "[" or "]".'),
      ).toBeTruthy();
      expect(values()).toEqual({ r: {} });
    },
  );

  it("空のキーはエラーにし、直すまでその組を値から外す（古いキーのまま送らない）", async () => {
    const { values } = renderForm(entries(), { r: { a: "x" } });
    await ready();
    const keyInput = screen.getByDisplayValue("a");
    fireEvent.change(keyInput, { target: { value: "" } });
    expect(await screen.findByText("Enter a key.")).toBeTruthy();
    expect(values()).toEqual({ r: {} });
    fireEvent.change(keyInput, { target: { value: "b" } });
    await waitFor(() => expect(values()).toEqual({ r: { b: "x" } }));
  });
});

describe("record に保存されていた、使えないキーの要素", () => {
  for (const [name, make] of [
    ["既定の見た目", plain],
    ["entries", entries],
  ] as const) {
    it(`${name}：キーと注記を出し、値は出さず、そのまま送る`, async () => {
      const { submit, onSubmit } = renderForm(make(), {
        r: { "a.b": "secret", ok: "y" },
      });
      await ready();
      expect(screen.getByText("a.b")).toBeTruthy();
      expect(screen.getByText(UNEDITABLE)).toBeTruthy();
      expect(screen.queryByDisplayValue("secret")).toBeNull();
      submit();
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          r: { "a.b": "secret", ok: "y" },
        }),
      );
    });

    it(`${name}：消すボタンで、その要素を消す`, async () => {
      const { values } = renderForm(make(), { r: { "a.b": "x", ok: "y" } });
      await ready();
      fireEvent.click(screen.getByRole("button", { name: "Remove a.b" }));
      await waitFor(() => expect(values()).toEqual({ r: { ok: "y" } }));
      expect(screen.queryByText(UNEDITABLE)).toBeNull();
    });

    it(`${name}：値が正しくなければ送信は止まり、エラーをその行に出す`, async () => {
      const { submit, onSubmit } = renderForm(
        make(z.string().min(3, "3 文字以上")),
        { r: { "a.b": "x" } },
      );
      await ready();
      submit();
      const message = await screen.findByText("3 文字以上");
      expect(
        message
          .closest("[data-zod-form-unsafe-entry]")
          ?.textContent?.includes("a.b"),
      ).toBe(true);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  }
});

describe("スキーマに書かれた、使えないキー", () => {
  it("object の shape のキー：その欄の場所に出し、console.error も出す", async () => {
    renderForm(
      z.object({
        "a.b": z.string().optional(),
        ok: z.string().optional(),
      }),
      {},
    );
    await ready();
    expect(screen.getByText(UNSAFE_NAME)).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported key "a.b"'),
    );
  });

  it("キーの決まった record の列挙のキー", async () => {
    renderForm(z.object({ r: z.record(z.enum(["a.b", "c"]), z.string()) }), {
      r: { "a.b": "", c: "" },
    });
    await ready();
    expect(screen.getByText(UNSAFE_NAME)).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});
