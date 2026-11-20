// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 検証と送信が同じ評価（FormRuntime.evaluate）を読むことを、描いたフォームで確かめる。
 * 親の .refine() は、dynamic を parse した後の値を受け取る
 */
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { renderForm, setupDomMocks } from "../testing/renderForm";

/** 同期で schema に決まる dynamic */
const dyn = (schema: z.ZodTypeAny) =>
  zf.dynamic().register(
    zf.dynamic.registry,
    defineDynamicMeta({
      resolve: () => ({ key: "fixed", schema }),
    }) as any,
  );

const object = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).register(zf.object.registry, {
    properties: Object.keys(shape),
  } as any);

const submitAndWait = async (t: ReturnType<typeof renderForm>) => {
  await act(async () => {
    t.submit();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

describe("dynamic の検証と送信を同じ評価で行う", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("変換する dynamic と、変換後の値を見る親の refine で送信できる", async () => {
    const schema = object({
      a: dyn(z.string().transform(Number)),
      b: z.number(),
    }).refine((v: any) => typeof v.a === "number" && v.a < v.b, "a < b");
    const t = renderForm(schema, { a: "3", b: 5 });
    await screen.findByDisplayValue("3");

    await submitAndWait(t);
    expect(t.onSubmit).toHaveBeenCalled();
    expect(t.runtime.parse(schema, t.values())).toEqual({
      success: true,
      data: { a: 3, b: 5 },
    });
  });

  it("path で dynamic の欄を指す親の refine のエラーを、その欄に出して送信を止める", async () => {
    const schema = object({
      a: dyn(z.string()),
      b: z.string(),
    }).refine((v: any) => v.a === v.b, {
      message: "一致しません",
      path: ["a"],
    });
    const t = renderForm(schema, { a: "x", b: "y" });
    await screen.findByDisplayValue("x");

    await submitAndWait(t);
    expect(t.onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("一致しません")).toBeTruthy();
  });

  it("dynamic が通らないときは、親の refine のエラーを出さない", async () => {
    const refine = vi.fn(() => false);
    const schema = object({
      a: dyn(z.string().min(3, "3文字以上")),
      b: z.string(),
    }).refine(refine, "親のエラー");
    const t = renderForm(schema, { a: "x", b: "y" });
    await screen.findByDisplayValue("x");

    await submitAndWait(t);
    expect(t.onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("3文字以上")).toBeTruthy();
    expect(screen.queryByText("親のエラー")).toBeNull();
    expect(refine).not.toHaveBeenCalled();
  });

  it("union の腕の中の dynamic が通らないとき、腕の欄に目印のエラーを出さない", async () => {
    const schema = object({
      v: zf.union([
        object({ x: dyn(z.string().min(3, "3文字以上")) }),
        object({ y: z.number() }),
      ]),
    });
    const t = renderForm(schema, { v: { x: "a" } });
    await screen.findByDisplayValue("a");

    await submitAndWait(t);
    expect(t.onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("3文字以上")).toBeTruthy());
    expect(JSON.stringify(t.runtime.validate(schema, t.values()))).not.toMatch(
      /dynamicUnresolved|symbol/,
    );
  });
});
