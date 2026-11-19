// @vitest-environment jsdom
/**
 * キーが enum・literal の z.partialRecord：既定は固定のキー＋optional、uiType entries は下でキーを足す形
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
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
