// @vitest-environment jsdom
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja as jaMessages } from "../messages";
import React, { Suspense } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ObjectComponent } from "./object";
import { component as EnumComponent } from "./enum";
import { component as ArrayOfEnumComponent } from "./array_multipleEnum";

const setupDomMocks = () => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
  if (!globalThis.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
};

const componentLibrary = {
  ...baseComponents,
  object: () => ({ component: ObjectComponent }),
  union_select: () => ({ component: EnumComponent }),
  union_badge: () => ({ component: EnumComponent }),
  array_multipleEnum: () => ({ component: ArrayOfEnumComponent }),
};

const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const formRef: { current: AnyFormApi | undefined } = { current: undefined };
  // useZodForm の validators は、値の型（Record<string, unknown>）の schema を受け取る
  const validator = schema as unknown as z.ZodType<
    Record<string, unknown>,
    Record<string, unknown>
  >;
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
      validators: {
        onChange: validator,
        onBlur: validator,
        onSubmit: validator,
      },
    });
    formRef.current = form as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <I18nMessagesProvider locale="ja" messages={jaMessages}>
          <ZodFormContextProvider componentLibrary={componentLibrary}>
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>送信</button>
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </I18nMessagesProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
  return formRef;
};

const valueOf = (formRef: { current: AnyFormApi | undefined }, key: string) =>
  (formRef.current!.state.values as Record<string, unknown>)[key];

/** ラベルの欄の入力（Select・MultiSelect の文字入力の欄） */
const findInput = (label: string) =>
  waitFor(() => {
    const input = screen
      .getAllByLabelText(new RegExp(`^${label}`))
      .find(
        (element) =>
          element.tagName === "INPUT" &&
          element.getAttribute("type") !== "hidden",
      );
    expect(input).toBeTruthy();
    return input as HTMLInputElement;
  });

const openAndSelect = async (input: HTMLElement, optionLabel: string) => {
  fireEvent.click(input);
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.click(
    await screen.findByRole("option", { name: optionLabel, hidden: true }),
  );
};

const amount = () =>
  zf.union([
    zf.literal(10).register(zf.literal.registry, { label: "十" }),
    zf.literal("10").register(zf.literal.registry, { label: "文字の十" }),
    zf.literal("abc").register(zf.literal.registry, { label: "エービーシー" }),
  ]);

describe("literal の union を選ぶ欄（union_select・union_badge）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('数値の腕なら数値、文字列の腕なら文字列を書き、literal(10) と literal("10") を区別する', async () => {
    const schema = z.object({
      amount: amount().register(zf.union.registry, {
        label: "金額",
        uiType: "select",
      }),
    });
    const formRef = renderForm(schema, {});
    const input = await findInput("金額");

    await openAndSelect(input, "十");
    await waitFor(() => expect(valueOf(formRef, "amount")).toBe(10));
    expect((input as HTMLInputElement).value).toBe("十");

    await openAndSelect(input, "文字の十");
    await waitFor(() => expect(valueOf(formRef, "amount")).toBe("10"));
    expect((input as HTMLInputElement).value).toBe("文字の十");
  });

  it("保存済みの値は、その腕のラベルで出す", async () => {
    const schema = z.object({
      amount: amount().register(zf.union.registry, {
        label: "金額",
        uiType: "select",
      }),
    });
    renderForm(schema, { amount: "10" });
    const input = await findInput("金額");
    await waitFor(() => expect(input.value).toBe("文字の十"));
  });

  it("必須のまま空で送信すると「必ず入力してください。」を出す", async () => {
    const schema = z.object({
      amount: amount().register(zf.union.registry, {
        label: "金額",
        uiType: "select",
      }),
    });
    renderForm(schema, {});
    await findInput("金額");
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(await screen.findByText("必ず入力してください。")).toBeTruthy();
  });

  it("optional なら × で undefined に戻し、nullable だけなら null に戻す", async () => {
    const schema = z.object({
      optionalAmount: amount()
        .register(zf.union.registry, { label: "任意", uiType: "select" })
        .optional(),
      nullableAmount: amount()
        .register(zf.union.registry, { label: "空にできる", uiType: "select" })
        .nullable(),
    });
    const formRef = renderForm(schema, {
      optionalAmount: "abc",
      nullableAmount: 10,
    });
    const clearButtons = await waitFor(() => {
      const buttons = document.querySelectorAll(
        "button.mantine-InputClearButton-root, .mantine-CloseButton-root",
      );
      expect(buttons.length).toBe(2);
      return buttons;
    });
    fireEvent.click(clearButtons[0]!);
    fireEvent.click(clearButtons[1]!);
    await waitFor(() => {
      expect(valueOf(formRef, "optionalAmount")).toBeUndefined();
      expect(valueOf(formRef, "nullableAmount")).toBeNull();
    });
  });

  it("選択肢に無い値は、既定では消す", async () => {
    const schema = z.object({
      amount: amount()
        .register(zf.union.registry, { label: "金額", uiType: "select" })
        .optional(),
    });
    const formRef = renderForm(schema, { amount: 99 });
    await waitFor(() => expect(valueOf(formRef, "amount")).toBeUndefined());
  });

  it("unlisted: keep なら値を残し、「選択肢に無い値です。」のエラーを出す", async () => {
    const schema = z.object({
      amount: amount()
        .register(zf.union.registry, {
          label: "金額",
          uiType: "select",
          unlisted: "keep",
        })
        .optional(),
    });
    const formRef = renderForm(schema, { amount: 99 });
    expect(
      await screen.findByText(
        "選択肢に無い値です。選び直すか、消してください。",
      ),
    ).toBeTruthy();
    expect(valueOf(formRef, "amount")).toBe(99);
  });

  it("バッジの形では、選んだ選択肢をバッジで出す", async () => {
    const schema = z.object({
      amount: amount().register(zf.union.registry, {
        label: "金額",
        uiType: "badge",
      }),
    });
    renderForm(schema, { amount: "abc" });
    await waitFor(() =>
      expect(screen.getByTestId("badge-select-value").textContent).toBe(
        "エービーシー",
      ),
    );
  });
});

describe("literal の union を複数選ぶ欄（array_multipleEnum）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const schema = z.object({
    amounts: zf
      .array(amount())
      .register(zf.array.registry, { label: "金額", uiType: "multipleEnum" })
      .optional(),
  });

  it("選んだ値を、数値・文字列のまま配列に入れる", async () => {
    const formRef = renderForm(schema, {});
    const input = await findInput("金額");
    await openAndSelect(input, "十");
    await waitFor(() => expect(valueOf(formRef, "amounts")).toEqual([10]));
    await openAndSelect(input, "文字の十");
    await waitFor(() =>
      expect(valueOf(formRef, "amounts")).toEqual([10, "10"]),
    );
  });

  it("保存済みの値は、その腕のラベルで出す", async () => {
    const formRef = renderForm(schema, { amounts: ["abc", 10] });
    // MultiSelect は、選んだ値を Pill（.mantine-Pill-label）で出す
    await waitFor(() => {
      const pills = [...document.querySelectorAll(".mantine-Pill-label")].map(
        (pill) => pill.textContent,
      );
      expect(pills).toEqual(["エービーシー", "十"]);
    });
    expect(valueOf(formRef, "amounts")).toEqual(["abc", 10]);
  });

  it("unlisted: keep の選択肢に無い値は、ほかを選んでも元の値のまま残す", async () => {
    const keepSchema = z.object({
      amounts: zf
        .array(amount().register(zf.union.registry, { unlisted: "keep" }))
        .register(zf.array.registry, {
          label: "金額",
          uiType: "multipleEnum",
        })
        .optional(),
    });
    const formRef = renderForm(keepSchema, { amounts: [99] });
    const input = await findInput("金額");
    await openAndSelect(input, "十");
    await waitFor(() => expect(valueOf(formRef, "amounts")).toEqual([99, 10]));
  });
});

describe("null・undefined の腕と、optional・nullable の併用（腕を優先する）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const answer = (...extra: z.ZodTypeAny[]) =>
    zf.union([
      zf.literal(true).register(zf.literal.registry, { label: "はい" }),
      zf.literal(false).register(zf.literal.registry, { label: "いいえ" }),
      ...extra,
    ] as unknown as [z.ZodTypeAny, z.ZodTypeAny]);
  const undefinedArm = () =>
    z.undefined().register(zf.common.registry, { label: "未回答" });
  const nullArm = () =>
    z.null().register(zf.common.registry, { label: "該当なし" });

  const clearButtons = () =>
    document.querySelectorAll(
      "button.mantine-InputClearButton-root, .mantine-CloseButton-root",
    );

  it("false の腕を選ぶと false を書く", async () => {
    const schema = z.object({
      answer: answer().register(zf.union.registry, {
        label: "回答",
        uiType: "select",
      }),
    });
    const formRef = renderForm(schema, {});
    await openAndSelect(await findInput("回答"), "いいえ");
    await waitFor(() => expect(valueOf(formRef, "answer")).toBe(false));
    expect((await findInput("回答")).value).toBe("いいえ");
  });

  it("optional でも undefined の腕があれば × を出さず、値が無いときはその腕を選んだ表示にする", async () => {
    const schema = z.object({
      answer: answer(undefinedArm())
        .register(zf.union.registry, { label: "回答", uiType: "select" })
        .optional(),
    });
    renderForm(schema, {});
    await waitFor(async () =>
      expect((await findInput("回答")).value).toBe("未回答"),
    );
    expect(clearButtons()).toHaveLength(0);
  });

  it("nullable でも null の腕があれば × を出さず、その腕を選ぶと null を書く", async () => {
    const schema = z.object({
      answer: answer(nullArm())
        .register(zf.union.registry, { label: "回答", uiType: "select" })
        .nullable(),
    });
    const formRef = renderForm(schema, { answer: true });
    const input = await findInput("回答");
    await waitFor(() => expect(input.value).toBe("はい"));
    expect(clearButtons()).toHaveLength(0);
    await openAndSelect(input, "該当なし");
    await waitFor(() => expect(valueOf(formRef, "answer")).toBeNull());
    expect(input.value).toBe("該当なし");
  });

  it("必須で null の腕を選ぶと、null を書いてエラーにしない", async () => {
    const schema = z.object({
      answer: answer(nullArm()).register(zf.union.registry, {
        label: "回答",
        uiType: "select",
      }),
    });
    const formRef = renderForm(schema, {});
    await openAndSelect(await findInput("回答"), "該当なし");
    await waitFor(() => expect(valueOf(formRef, "answer")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    await waitFor(() => expect(formRef.current!.state.isSubmitted).toBe(true));
    expect(screen.queryByText("必ず入力してください。")).toBeNull();
  });

  it("optional・nullable で undefined の腕だけなら、× で null を書く", async () => {
    const schema = z.object({
      answer: answer(undefinedArm())
        .register(zf.union.registry, { label: "回答", uiType: "select" })
        .optional()
        .nullable(),
    });
    const formRef = renderForm(schema, { answer: true });
    const buttons = await waitFor(() => {
      expect(clearButtons()).toHaveLength(1);
      return clearButtons();
    });
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(valueOf(formRef, "answer")).toBeNull());
  });

  it("optional・nullable で null の腕だけなら、× で undefined を書く", async () => {
    const schema = z.object({
      answer: answer(nullArm())
        .register(zf.union.registry, { label: "回答", uiType: "select" })
        .optional()
        .nullable(),
    });
    const formRef = renderForm(schema, { answer: true });
    const buttons = await waitFor(() => {
      expect(clearButtons()).toHaveLength(1);
      return clearButtons();
    });
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(valueOf(formRef, "answer")).toBeUndefined());
  });

  it("optional・nullable で両方の腕があれば × を出さない", async () => {
    const schema = z.object({
      answer: answer(undefinedArm(), nullArm())
        .register(zf.union.registry, { label: "回答", uiType: "badge" })
        .optional()
        .nullable(),
    });
    renderForm(schema, { answer: null });
    await waitFor(() =>
      expect(screen.getByTestId("badge-select-value").textContent).toBe(
        "該当なし",
      ),
    );
    expect(clearButtons()).toHaveLength(0);
  });
});
