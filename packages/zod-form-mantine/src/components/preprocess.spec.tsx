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
import {
  HiddenComponent,
  OptionalComponent,
} from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as LiteralComponent } from "./literal";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as UnionComponent } from "./union";

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

/** 判別子（type）の無い古い形のデータに type を補う */
const fillType = (value: unknown) =>
  value && typeof value === "object" && !("type" in value) && "address" in value
    ? { type: "email", ...value }
    : value;

const emailArm = z
  .object({
    type: zf.literal("email").register(zf.literal.registry, { hidden: true }),
    address: zf.string().register(zf.string.registry, { label: "宛先" }),
  })
  .register(zf.object.registry, { label: "メール" });

const webhookArm = z
  .object({
    type: zf.literal("webhook").register(zf.literal.registry, { hidden: true }),
    url: zf.string().register(zf.string.registry, { label: "URL" }),
  })
  .register(zf.object.registry, { label: "Webhook" });

const componentLibrary = {
  hidden: () => ({ component: HiddenComponent }),
  optional: () => ({ component: OptionalComponent }),
  literal: () => ({ component: LiteralComponent }),
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  union: () => ({ component: UnionComponent }),
};

const renderForm = (
  schema: z.ZodTypeAny,
  defaultValues: unknown,
  onForm: (form: AnyFormApi) => void,
) => {
  const FormUnderTest = () => {
    const validator = schema as unknown as z.ZodType<
      Record<string, unknown>,
      Record<string, unknown>
    >;
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
      validators: {
        onChange: validator,
        onBlur: validator,
        onSubmit: validator,
      },
    });
    onForm(form as unknown as AnyFormApi);
    return (
      <MantineProvider>
        <ZodFormContextProvider componentLibrary={componentLibrary}>
          <FormProvider form={form}>
            <Suspense fallback={null}>
              <Switch fieldPath="" schema={schema as z.ZodTypeAny} />
            </Suspense>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  return render(<FormUnderTest />);
};

describe("z.preprocess を挟んだ schema", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("preprocess に union の meta を付けた形を、標準の union で描画できる。判別子の無い過去データも腕が決まる", async () => {
    const destination = z.preprocess(
      fillType,
      z.discriminatedUnion("type", [emailArm, webhookArm]),
    );
    (destination as unknown as z.ZodDiscriminatedUnion).register(
      zf.union.registry,
      { label: "通知先", selectorLabel: "通知方法" },
    );
    const schema = z
      .object({ destination })
      .register(zf.object.registry, { properties: ["destination"] });

    let form: AnyFormApi | undefined;
    renderForm(schema, { destination: { address: "a@example.com" } }, (f) => {
      form = f;
    });

    // 選択肢と腕の中身が出て、値に判別子が補われる
    expect(await screen.findByText("通知方法")).toBeTruthy();
    expect(await screen.findByDisplayValue("a@example.com")).toBeTruthy();
    await waitFor(() =>
      expect(form!.getFieldValue("destination")).toEqual({
        type: "email",
        address: "a@example.com",
      }),
    );
    const selectInput = document.querySelector(
      "input.mantine-Select-input",
    ) as HTMLInputElement;
    expect(selectInput.value).toBe("メール");
    // 補っただけでは触った扱いにしない
    expect(form!.getFieldMeta("destination")?.isTouched ?? false).toBe(false);

    // Webhook へ切り替えられる
    fireEvent.click(selectInput);
    fireEvent.focus(selectInput);
    fireEvent.keyDown(selectInput, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", {
        name: "Webhook",
        hidden: true,
      }),
    );
    await waitFor(() =>
      expect(form!.getFieldValue("destination")).toMatchObject({
        type: "webhook",
      }),
    );
    expect(form!.getFieldValue("destination")).not.toHaveProperty("address");
  });

  it("preprocess → optional → preprocess → object の入れ子も、標準の object で描画できる", async () => {
    const config = z.preprocess(fillType, emailArm);
    const optionalConfig = z.preprocess((v) => v, config.optional());
    (optionalConfig as unknown as z.ZodObject).register(zf.object.registry, {
      label: "既定の通知先",
    });
    const schema = z
      .object({ fallback: optionalConfig })
      .register(zf.object.registry, { properties: ["fallback"] });

    let form: AnyFormApi | undefined;
    renderForm(schema, { fallback: { address: "b@example.com" } }, (f) => {
      form = f;
    });

    expect(await screen.findByText("既定の通知先")).toBeTruthy();
    expect(await screen.findByDisplayValue("b@example.com")).toBeTruthy();
    await waitFor(() =>
      expect(form!.getFieldValue("fallback")).toEqual({
        type: "email",
        address: "b@example.com",
      }),
    );
  });
});
