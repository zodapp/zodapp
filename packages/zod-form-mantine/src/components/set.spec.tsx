// @vitest-environment jsdom
/**
 * set（#4）：値全体を 1 つの欄で扱い、Set を書き込む
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import userEvent from "@testing-library/user-event";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const TAG_PLACEHOLDER = "Type and press Enter to add";
const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });
const openOptions = (input: HTMLInputElement) => {
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
};

describe("set", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  for (const [name, make] of [
    ["z.set", () => z.set(z.enum(["a", "b", "c"]))],
    [
      "zf.set",
      () =>
        zf.set(z.enum(["a", "b", "c"])).register(zf.set.registry, {
          label: "種類",
        }),
    ],
  ] as const) {
    it(`${name}(enum)：複数選択で Set を書き込み、送信できる`, async () => {
      const { values, submit, onSubmit, container } = renderForm(
        z.object({ kinds: make() }),
        { kinds: new Set(["a"]) },
      );
      await ready();
      const input = container.querySelector("input") as HTMLInputElement;
      openOptions(input);
      fireEvent.click(
        await screen.findByRole("option", { name: "c", hidden: true }),
      );
      await waitFor(() => expect(values().kinds).toEqual(new Set(["a", "c"])));
      expect(values().kinds).toBeInstanceOf(Set);
      submit();
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0]![0].kinds).toEqual(new Set(["a", "c"]));
    });
  }

  it("値を複数持つ literal・literal の union の要素も選べる", async () => {
    const { container } = renderForm(
      z.object({
        a: z.set(z.literal(["x", "y"])),
        b: z.set(z.union([z.literal("p"), z.literal("q")])),
      }),
      { a: new Set(["x"]), b: new Set(["q"]) },
    );
    await ready();
    expect(container.querySelectorAll("input").length).toBeGreaterThan(0);
    expect(screen.queryByText(/cannot handle/)).toBeNull();
  });

  it("set(string)：タグ入力。重複は入らない", async () => {
    const { values } = renderForm(z.object({ tags: z.set(z.string()) }), {
      tags: new Set(["a"]),
    });
    await ready();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(TAG_PLACEHOLDER);
    await user.type(input, "b{enter}");
    await waitFor(() => expect(values().tags).toEqual(new Set(["a", "b"])));
    await user.type(input, "a{enter}");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(values().tags).toEqual(new Set(["a", "b"]));
  });

  it("set(number)：数として書き込む", async () => {
    const { values } = renderForm(z.object({ nums: z.set(z.number()) }), {
      nums: new Set([1]),
    });
    await ready();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(TAG_PLACEHOLDER), "2{enter}");
    await waitFor(() => expect(values().nums).toEqual(new Set([1, 2])));
  });

  it("要素が object の set は、扱えないと出す", async () => {
    renderForm(z.object({ s: z.set(z.object({ a: z.string() })) }), {
      s: new Set(),
    });
    await ready();
    expect(
      screen.getByText("This form cannot handle this combination of schemas."),
    ).toBeTruthy();
  });

  it("要素の検査のエラーを set の欄に出す", async () => {
    const { submit, onSubmit, container } = renderForm(
      z.object({ tags: z.set(z.string().min(2, "2 文字以上")) }),
      { tags: new Set(["a"]) },
    );
    await ready();
    expect(container.querySelector("input")).toBeTruthy();
    submit();
    expect(await screen.findByText("2 文字以上")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("optional の set を空にすると、undefined を書く", async () => {
    const { values, container } = renderForm(
      z.object({ tags: z.set(z.string()).optional() }),
      { tags: new Set(["a"]) },
    );
    await ready();
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });
    await waitFor(() => expect(values().tags).toBeUndefined());
  });
});
