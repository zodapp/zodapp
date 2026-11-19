// @vitest-environment jsdom
/**
 * z.templateLiteral()（文字列の欄）・z.file()（FileInput）・z.map()（entries の見た目）
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks } from "../testing/renderForm";

const labeled = <T extends z.ZodTypeAny>(schema: T, label: string) =>
  schema.register(zf.common.registry, { label });

beforeEach(() => {
  setupDomMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("z.templateLiteral()", () => {
  it("文字列の欄で描き、形は zod の検証で確かめる", async () => {
    const schema = z.object({
      id: labeled(z.templateLiteral(["user-", z.number()]), "ID"),
    });
    const { values, submit, onSubmit } = renderForm(schema, {});
    const input = await screen.findByLabelText(/^ID/);
    fireEvent.change(input, { target: { value: "bad" } });
    expect(values()).toEqual({ id: "bad" });
    submit();
    await waitFor(() =>
      expect(document.querySelector(".mantine-TextInput-error")).toBeTruthy(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "user-12" } });
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toEqual({ id: "user-12" });
  });
});

describe("z.file()", () => {
  it("File を値に持つ入力欄を描き、選んだ File を送る", async () => {
    const schema = z.object({
      file: labeled(z.file().mime(["text/plain"]), "ファイル"),
    });
    const { container, values, submit, onSubmit } = renderForm(schema, {});
    await screen.findByText("ファイル");
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input.accept).toBe("text/plain");
    const file = new File(["hello"], "a.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(values().file).toBe(file));
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].file).toBe(file);
  });

  it("zod の検査のエラーを欄に出す", async () => {
    const schema = z.object({
      file: labeled(z.file().mime(["image/png"]), "ファイル"),
    });
    const { submit, onSubmit } = renderForm(schema, {
      file: new File(["x"], "a.txt", { type: "text/plain" }),
    });
    expect(await screen.findByText("a.txt")).toBeTruthy();
    submit();
    await waitFor(() =>
      expect(document.querySelector(".mantine-FileInput-error")).toBeTruthy(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("z.map()", () => {
  it("今のキーと値を描き、値を書き換えると Map 全体を書く", async () => {
    const schema = z.object({
      m: labeled(z.map(z.string(), z.number()), "マップ"),
    });
    const { values } = renderForm(schema, {
      m: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    });
    expect(await screen.findByDisplayValue("a")).toBeTruthy();
    expect(screen.getByDisplayValue("b")).toBeTruthy();
    const valueInput = screen.getByDisplayValue("2");
    fireEvent.change(valueInput, { target: { value: "5" } });
    await waitFor(() =>
      expect(values().m).toEqual(
        new Map([
          ["a", 1],
          ["b", 5],
        ]),
      ),
    );
  });

  it("行を足してキーを入れ、キーの名前を変え、行を消す", async () => {
    const schema = z.object({
      m: labeled(z.map(z.string(), z.string()), "マップ"),
    });
    const { values } = renderForm(schema, { m: new Map([["a", "x"]]) });
    await screen.findByDisplayValue("a");
    fireEvent.click(screen.getByRole("button", { name: "Add to the end" }));
    const keyInputs = await screen.findAllByLabelText("Key");
    fireEvent.change(keyInputs[1]!, { target: { value: "b" } });
    await waitFor(() =>
      expect(Array.from((values().m as Map<string, unknown>).keys())).toEqual([
        "a",
        "b",
      ]),
    );
    fireEvent.change(screen.getByDisplayValue("a"), {
      target: { value: "c" },
    });
    await waitFor(() =>
      expect(values().m).toEqual(
        new Map([
          ["c", "x"],
          ["b", undefined],
        ]),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove c" }));
    await waitFor(() =>
      expect(values().m).toEqual(new Map([["b", undefined]])),
    );
  });

  it("数のキーは数として書き、重複したキーは書かない", async () => {
    const schema = z.object({
      m: labeled(z.map(z.number(), z.boolean()), "マップ"),
    });
    const { values } = renderForm(schema, { m: new Map([[1, true]]) });
    await screen.findByDisplayValue("1");
    fireEvent.click(screen.getByRole("button", { name: "Add to the end" }));
    const keyInputs = await screen.findAllByLabelText("Key");
    fireEvent.change(keyInputs[1]!, { target: { value: "1" } });
    expect(await screen.findByText("This key already exists.")).toBeTruthy();
    fireEvent.change(keyInputs[1]!, { target: { value: "2" } });
    await waitFor(() =>
      expect(values().m).toEqual(
        new Map([
          [1, true],
          [2, undefined],
        ]),
      ),
    );
  });

  it("値のエラーを、その行の値の欄に出す", async () => {
    const schema = z.object({
      m: labeled(z.map(z.string(), z.string().min(3, "3文字以上")), "マップ"),
    });
    const { submit, onSubmit } = renderForm(schema, {
      m: new Map([["a", "x"]]),
    });
    await screen.findByDisplayValue("a");
    submit();
    expect(await screen.findByText("3文字以上")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("キー・値の型が描けなければ、注記を出す", async () => {
    const schema = z.object({
      m: labeled(z.map(z.string(), z.object({ a: z.string() })), "マップ"),
    });
    renderForm(schema, { m: new Map() });
    expect(
      await screen.findByText(
        "This form cannot handle this combination of schemas.",
      ),
    ).toBeTruthy();
  });
});
