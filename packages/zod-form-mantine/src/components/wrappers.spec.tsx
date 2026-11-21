// @vitest-environment jsdom
/**
 * 包みを外して中を描く型（`.readonly()`・`.catch()`・`.nonoptional()`・`.prefault()`）
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf, getDefaultValue } from "@zodapp/zod-form";
import { renderForm, setupDomMocks } from "../testing/renderForm";

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

describe("包みを外して中を描く", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  for (const [name, inner] of [
    [
      "z",
      z.object({ a: z.string().register(zf.string.registry, { label: "A" }) }),
    ],
    ["zf", zf.object({ a: text("A") })],
  ] as const) {
    it(`${name}: readonly な object の中の欄を描き、入力できる`, async () => {
      const schema = z.object({ o: inner.readonly() });
      const { values, submit, onSubmit } = renderForm(schema, { o: { a: "" } });
      const input = await screen.findByLabelText(/^A/);
      fireEvent.change(input, { target: { value: "x" } });
      expect(values()).toEqual({ o: { a: "x" } });
      submit();
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0]![0]).toEqual({ o: { a: "x" } });
    });
  }

  it("catch の中を描き、検証は zod に任せる（中で落ちる値でも送信は通る）", async () => {
    const schema = z.object({ n: text("N").min(3).catch("fallback") });
    const { submit, onSubmit } = renderForm(schema, { n: "a" });
    expect(await screen.findByDisplayValue("a")).toBeTruthy();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // 送信の parse で catch の値に置き換わる
    expect(schema.parse(onSubmit.mock.calls[0]![0])).toEqual({ n: "fallback" });
  });

  it("nonoptional は外側の optional を打ち消し、必須として描く", async () => {
    const schema = z.object({ a: text("A").optional().nonoptional() });
    const { submit, onSubmit } = renderForm(schema, {});
    await screen.findByLabelText(/A/);
    submit();
    await waitFor(() =>
      expect(
        document.querySelector("[data-error], .mantine-InputWrapper-error"),
      ).toBeTruthy(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefault の値を初期値に入れ、中を描く", async () => {
    const schema = z.object({ a: text("A").prefault("初期") });
    renderForm(schema, getDefaultValue(schema));
    expect(await screen.findByDisplayValue("初期")).toBeTruthy();
  });

  it("扱えない注記を出さない", async () => {
    const schema = z.object({
      r: text("R").readonly(),
      c: text("C").catch(""),
      n: text("N").nonoptional(),
      p: text("P").prefault(""),
    });
    renderForm(schema, { r: "", c: "", n: "", p: "" });
    await screen.findByLabelText(/^R/);
    expect(document.querySelector("[data-zod-form-unsupported]")).toBeNull();
  });
});
