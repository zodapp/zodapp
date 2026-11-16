// @vitest-environment jsdom
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
import { component as StringComponent } from "./string";
import { component as NumberComponent } from "./number";

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
};

const componentLibrary = {
  ...baseComponents,
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  number: () => ({ component: NumberComponent }),
};

const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const formRef: { current: AnyFormApi | undefined } = { current: undefined };
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
    });
    formRef.current = form as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <ZodFormContextProvider componentLibrary={componentLibrary}>
          <FormProvider form={form}>
            <Suspense fallback={null}>
              <Switch fieldPath="" schema={schema} />
            </Suspense>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
  return formRef;
};

const valueOf = (formRef: { current: AnyFormApi | undefined }, key: string) =>
  (formRef.current!.state.values as Record<string, unknown>)[key];

describe("空にした欄に書く値（optional なら undefined、nullable だけなら null）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const schema = z.object({
    required: zf.string().register(zf.string.registry, { label: "必須" }),
    nullableText: zf
      .string()
      .register(zf.string.registry, { label: "空にできる文字" })
      .nullable(),
    both: zf
      .string()
      .register(zf.string.registry, { label: "両方" })
      .optional()
      .nullable(),
    nullableNumber: zf
      .number()
      .register(zf.number.registry, { label: "空にできる数値" })
      .nullable(),
  });

  it("nullable だけの文字の欄は null、optional と nullable の両方なら undefined、必須なら undefined を書く", async () => {
    const formRef = renderForm(schema, {
      required: "a",
      nullableText: "b",
      both: "c",
      nullableNumber: 1,
    });
    const input = (label: string) =>
      screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
    await waitFor(() => expect(input("空にできる文字").value).toBe("b"));

    fireEvent.change(input("必須"), { target: { value: "" } });
    fireEvent.change(input("空にできる文字"), { target: { value: "" } });
    fireEvent.change(input("両方"), { target: { value: "" } });

    await waitFor(() => expect(valueOf(formRef, "nullableText")).toBeNull());
    expect(valueOf(formRef, "required")).toBeUndefined();
    expect(valueOf(formRef, "both")).toBeUndefined();
    expect("both" in (formRef.current!.state.values as object)).toBe(true);
  });

  it("nullable だけの数値の欄を空にすると null を書き、検証に通る", async () => {
    const formRef = renderForm(schema, {
      required: "a",
      nullableText: "b",
      both: "c",
      nullableNumber: 1,
    });
    const input = screen.getByLabelText(/^空にできる数値/) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("1"));

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(valueOf(formRef, "nullableNumber")).toBeNull());
    expect(schema.safeParse(formRef.current!.state.values).success).toBe(true);
  });

  it("nullable だけの object を削除すると null を書き、＋の行に戻る", async () => {
    const objectSchema = z.object({
      detail: zf
        .object({
          note: zf.string().register(zf.string.registry, { label: "備考" }),
        })
        .register(zf.object.registry, { label: "詳細" })
        .nullable(),
    });
    const formRef = renderForm(objectSchema, { detail: { note: "x" } });
    const remove = await screen.findByRole("button", { name: "削除" });

    fireEvent.click(remove);
    await waitFor(() => expect(valueOf(formRef, "detail")).toBeNull());
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
    expect(objectSchema.safeParse(formRef.current!.state.values).success).toBe(
      true,
    );
  });
});
