// @vitest-environment jsdom
/**
 * 欄を出さず値を保つ型（any・unknown・custom・symbol・function・never）と、固定値の z.nan()
 */
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf, getDefaultValue } from "@zodapp/zod-form";
import { renderForm, setupDomMocks } from "../testing/renderForm";

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

describe("欄を出さず、値を保つ", () => {
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

  it("値のある any・unknown・custom・symbol・function を出さず、そのまま送る", async () => {
    const sym = Symbol("s");
    const fn = () => 1;
    const schema = z.object({
      name: text("名前"),
      a: z.any().register(zf.common.registry, { label: "A", hidden: false }),
      u: z.unknown(),
      c: z.custom<{ then: unknown }>((v) => typeof v === "object"),
      s: z.symbol(),
      f: z.function(),
    });
    const value = { name: "x", a: { deep: 1 }, u: [1], c: { then: 1 }, s: sym, f: fn };
    const { submit, onSubmit } = renderForm(schema, value);
    await screen.findByDisplayValue("x");
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByText(/Component not found/)).toBeNull();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0]![0];
    expect(sent.s).toBe(sym);
    expect(sent.f).toBe(fn);
    expect(sent.a).toEqual({ deep: 1 });
  });

  it("値が無くてエラーになる欄は、エラーだけを出して送信を止める", async () => {
    const schema = z.object({ name: text("名前"), s: z.symbol() });
    const { submit, onSubmit } = renderForm(schema, { name: "x" });
    await screen.findByDisplayValue("x");
    submit();
    await waitFor(() =>
      expect(document.querySelector(".mantine-Text-root")?.textContent ?? "").not.toBe(""),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("z.never() は出さず、キーが無ければ送信が通る", async () => {
    const schema = z.object({ name: text("名前"), n: z.never().optional() });
    const { submit, onSubmit } = renderForm(schema, { name: "x" });
    await screen.findByDisplayValue("x");
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});

describe("z.nan() は固定値", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("既定では出さず、getDefaultValue の NaN で送信が通る", async () => {
    const schema = z.object({ name: text("名前"), n: z.nan() });
    const { submit, onSubmit } = renderForm(
      schema,
      getDefaultValue(schema, { name: "x" }),
    );
    await screen.findByDisplayValue("x");
    expect(screen.queryByText("NaN")).toBeNull();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(Number.isNaN(onSubmit.mock.calls[0]![0].n)).toBe(true);
  });

  it("hidden: false なら NaN と出す", async () => {
    const schema = z.object({
      n: z.nan().register(zf.common.registry, { label: "N", hidden: false }),
    });
    renderForm(schema, { n: NaN });
    expect(await screen.findByText("NaN")).toBeTruthy();
  });
});
