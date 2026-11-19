// @vitest-environment jsdom
/**
 * literal 系（#3）：固定値（値が 1 つの literal・null・undefined・void）は既定で出さず、
 * 値が無ければ書き込む。値を複数持つ literal は enum と同じに選ぶ
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });

describe("literal 系", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("固定値", () => {
    for (const [name, make] of [
      ["z", () => z.literal("v1")],
      [
        "zf",
        () => zf.literal("v1").register(zf.literal.registry, { label: "版" }),
      ],
    ] as const) {
      it(`${name}.literal：出さず、値が無ければ書き込み、送信できる`, async () => {
        const { values, submit, onSubmit } = renderForm(
          z.object({ name: text("名前"), version: make() }),
          { name: "a" },
        );
        await ready();
        expect(screen.queryByText("v1")).toBeNull();
        expect(screen.queryByText("版")).toBeNull();
        await waitFor(() => expect(values().version).toBe("v1"));
        submit();
        await waitFor(() =>
          expect(onSubmit).toHaveBeenCalledWith({ name: "a", version: "v1" }),
        );
      });
    }

    it("hidden: false なら、readOnly の表示でスキーマの値を出す（必須の印は付けない）", async () => {
      renderForm(
        z.object({
          version: zf
            .literal(3)
            .register(zf.literal.registry, { label: "版", hidden: false }),
        }),
        {},
      );
      await ready();
      expect(screen.getByText("3")).toBeTruthy();
      const label = screen.getByText("版");
      expect(label.textContent).toBe("版");
      expect(label.querySelector(".mantine-InputWrapper-required")).toBeNull();
    });

    it("値が違うときは、送信でエラーだけを出す", async () => {
      const { submit, onSubmit } = renderForm(
        z.object({ version: z.literal("v1") }),
        { version: "v0" },
      );
      await ready();
      submit();
      await waitFor(() => expect(screen.getByText(/v1/)).toBeTruthy());
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("optional の literal は、値が無くても書き込まない", async () => {
      const { values } = renderForm(
        z.object({ version: z.literal("v1").optional() }),
        {},
      );
      await ready();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(values().version).toBeUndefined();
    });

    for (const [name, schema, expected] of [
      ["null", z.null(), null],
      ["undefined", z.undefined(), undefined],
      ["void", z.void(), undefined],
    ] as const) {
      it(`z.${name}()：Not found を出さず、何も出さない`, async () => {
        const { submit, onSubmit } = renderForm(
          z.object({ name: text("名前"), x: schema }),
          { name: "a" },
        );
        await ready();
        expect(screen.queryByText(/not found/i)).toBeNull();
        submit();
        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0]![0].x).toBe(expected);
      });
    }

    it("union の null の腕：選んでも選択欄だけが残る", async () => {
      renderForm(
        z.object({
          v: zf
            .union([
              zf.string().register(zf.string.registry, { label: "文字" }),
              z.null().register(zf.common.registry, { label: "なし" }),
            ])
            .register(zf.union.registry, { label: "値" }),
        }),
        { v: null },
      );
      await ready();
      expect(screen.queryByText(/not found/i)).toBeNull();
    });

    it("discriminatedUnion の腕の中に、discriminator を出さない", async () => {
      renderForm(
        z.object({
          n: z
            .discriminatedUnion("type", [
              zf
                .object({
                  type: zf
                    .literal("sms")
                    .register(zf.literal.registry, { label: "SMS" }),
                  phone: text("電話"),
                })
                .register(zf.object.registry, { label: "SMS" }),
              zf
                .object({
                  type: zf
                    .literal("mail")
                    .register(zf.literal.registry, { label: "メール" }),
                  to: text("宛先"),
                })
                .register(zf.object.registry, { label: "メール" }),
            ])
            .register(zf.union.registry, { label: "通知" }),
        }),
        { n: { type: "sms", phone: "1" } },
      );
      await ready();
      await screen.findByText("電話");
      expect(screen.queryByText("sms")).toBeNull();
    });
  });

  describe("値を複数持つ literal", () => {
    for (const [name, make] of [
      ["z", () => z.literal(["a", "b"])],
      [
        "zf",
        () =>
          zf
            .literal(["a", "b"])
            .register(zf.literal.registry, { label: "種類" }),
      ],
    ] as const) {
      it(`${name}.literal([...])：選択欄で選べ、送信できる`, async () => {
        const { values, submit, onSubmit } = renderForm(
          z.object({ kind: make() }),
          {},
        );
        await ready();
        const input = screen.getByRole("combobox") as HTMLInputElement;
        fireEvent.click(input);
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.click(
          await screen.findByRole("option", { name: "b", hidden: true }),
        );
        await waitFor(() => expect(values().kind).toBe("b"));
        submit();
        await waitFor(() =>
          expect(onSubmit).toHaveBeenCalledWith({ kind: "b" }),
        );
      });
    }

    it("multipleEnum の要素にできる", async () => {
      const { values } = renderForm(
        z.object({
          kinds: z
            .array(z.literal(["a", "b", "c"]))
            .register(zf.array.registry, {
              label: "種類",
              uiType: "multipleEnum",
            }),
        }),
        { kinds: ["a"] },
      );
      await ready();
      const input = document.querySelector(
        "input.mantine-MultiSelect-inputField, input",
      ) as HTMLInputElement;
      fireEvent.click(input);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.click(
        await screen.findByRole("option", { name: "c", hidden: true }),
      );
      await waitFor(() => expect(values().kinds).toEqual(["a", "c"]));
    });
  });
});
