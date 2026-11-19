// @vitest-environment jsdom
/**
 * pipe（#2）：入口（in）の型で描き、入力して送信できる
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });
const typeInto = (value: string) => {
  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe("pipe を入口の型で描く", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const cases: [string, z.ZodTypeAny, string, unknown][] = [
    [
      "string の transform",
      z.string().transform((v) => v.toUpperCase()),
      "abc",
      "abc",
    ],
    [
      "pipe(string, string.min(2))",
      z.string().pipe(z.string().min(2)),
      "ab",
      "ab",
    ],
    [
      "transform(Number).pipe(number)",
      z.string().transform(Number).pipe(z.number()),
      "12",
      "12",
    ],
    [
      "codec（iso.datetime ↔ date）",
      z.codec(z.iso.datetime(), z.date(), {
        decode: (value) => new Date(value),
        encode: (date) => date.toISOString(),
      }),
      "2026-01-02T03:04:05Z",
      "2026-01-02T03:04:05Z",
    ],
    ["stringbool", z.stringbool(), "true", "true"],
  ];

  for (const [name, schema, input, formValue] of cases) {
    it(`${name}：入口の型の欄で入力し、送信できる`, async () => {
      const { values, submit, onSubmit } = renderForm(
        z.object({ v: schema }),
        {},
      );
      await ready();
      typeInto(input);
      await waitFor(() => expect(values().v).toBe(formValue));
      submit();
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    });
  }

  it("pipe 全体の検査（入口の型の値を受け取る）で、送信が止まる", async () => {
    const { submit, onSubmit } = renderForm(
      z.object({ v: z.string().pipe(z.string().min(3, "3 文字以上")) }),
      {},
    );
    await ready();
    typeInto("ab");
    submit();
    expect(await screen.findByText("3 文字以上")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pipe に付けた label を、入口の欄の名前にする（z・zf のどちらでも）", async () => {
    renderForm(
      z.object({
        a: z
          .string()
          .transform((v) => v.trim())
          .register(zf.common.registry, { label: "名前" }),
        b: zf
          .string()
          .register(zf.string.registry, { label: "メモ" })
          .transform((v) => v.trim()),
      }),
      {},
    );
    await ready();
    expect(screen.getByText("名前")).toBeTruthy();
    expect(screen.getByText("メモ")).toBeTruthy();
  });
});
