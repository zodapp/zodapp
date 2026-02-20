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
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import {
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";

import { component as HiddenComponent } from "./hidden";
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

const openAndSelect = async (optionLabel: string) => {
  const maybeSelectInput = document.querySelector(
    "input.mantine-Select-input",
  ) as HTMLInputElement | null;
  expect(maybeSelectInput).toBeTruthy();
  const selectInput = maybeSelectInput as HTMLInputElement;
  fireEvent.click(selectInput);
  fireEvent.focus(selectInput);
  fireEvent.keyDown(selectInput, { key: "ArrowDown" });
  fireEvent.click(
    await screen.findByRole("option", { name: optionLabel, hidden: true }),
  );
};

describe("UnionComponent discriminatedUnion regression", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("can switch discriminator from proxy to scenario", async () => {
    const destinationSchema = z
      .discriminatedUnion("type", [
        z
          .object({
            phoneNumber: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
            type: zf
              .literal("proxy")
              .register(zf.literal.registry, { hidden: true }),
            url: zf.string().register(zf.string.registry, { label: "URL" }),
          })
          .register(zf.object.registry, { label: "プロキシ" }),
        z
          .object({
            phoneNumber: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
            type: zf
              .literal("scenario")
              .register(zf.literal.registry, { hidden: true }),
            scenarioId: zf
              .string()
              .register(zf.string.registry, { label: "シナリオID" }),
          })
          .register(zf.object.registry, { label: "シナリオ" }),
      ])
      .register(zf.union.registry, {
        label: "発信先タイプ",
        selectorLabel: "タイプ",
      });

    const schema = z
      .object({
        payload: destinationSchema,
      })
      .register(zf.object.registry, { properties: ["payload"] });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          payload: {
            type: "proxy" as const,
            phoneNumber: "09011112222",
            url: "https://example.com",
          },
        } as z.input<typeof schema>,
        validators: {
          onChange: schema,
          onBlur: schema,
          onSubmit: schema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              hidden: () => ({ component: HiddenComponent }),
              literal: () => ({ component: LiteralComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Dynamic fieldPath="" schema={schema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    const beforeHidden = document.querySelector(
      'input[type="hidden"]',
    ) as HTMLInputElement | null;
    expect(beforeHidden?.value).toBe("proxy");

    await openAndSelect("シナリオ");

    await waitFor(() => {
      const afterHidden = document.querySelector(
        'input[type="hidden"]',
      ) as HTMLInputElement | null;
      expect(afterHidden?.value).toBe("scenario");

      const selectInput = document.querySelector(
        "input.mantine-Select-input",
      ) as HTMLInputElement | null;
      expect(selectInput?.value).toBe("シナリオ");
    });
  });

  it("keeps common field value after switching discriminator", async () => {
    const destinationSchema = z
      .discriminatedUnion("type", [
        z
          .object({
            phoneNumber: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
            type: zf
              .literal("proxy")
              .register(zf.literal.registry, { hidden: true }),
            url: zf.string().register(zf.string.registry, { label: "URL" }),
          })
          .register(zf.object.registry, { label: "プロキシ" }),
        z
          .object({
            phoneNumber: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
            type: zf
              .literal("scenario")
              .register(zf.literal.registry, { hidden: true }),
            scenarioId: zf
              .string()
              .register(zf.string.registry, { label: "シナリオID" }),
          })
          .register(zf.object.registry, { label: "シナリオ" }),
      ])
      .register(zf.union.registry, {
        label: "発信先タイプ",
        selectorLabel: "タイプ",
      });

    const schema = z
      .object({
        payload: destinationSchema,
      })
      .register(zf.object.registry, { properties: ["payload"] });
    const defaultValues: z.input<typeof schema> = {
      payload: {
        type: "proxy",
        phoneNumber: "09011112222",
        url: "https://example.com",
      },
    };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onChange: schema,
          onBlur: schema,
          onSubmit: schema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              hidden: () => ({ component: HiddenComponent }),
              literal: () => ({ component: LiteralComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Dynamic fieldPath="" schema={schema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    expect(await screen.findByDisplayValue("09011112222")).toBeTruthy();
    await openAndSelect("シナリオ");

    await waitFor(() => {
      const hidden = document.querySelector(
        'input[type="hidden"]',
      ) as HTMLInputElement | null;
      expect(hidden?.value).toBe("scenario");
    });

    expect(await screen.findByDisplayValue("09011112222")).toBeTruthy();
    const selectInput = document.querySelector(
      "input.mantine-Select-input",
    ) as HTMLInputElement | null;
    expect(selectInput?.value).toBe("シナリオ");
  });

  it("allows editing common field after switching discriminator", async () => {
    const destinationSchema = z
      .discriminatedUnion("type", [
        z
          .object({
            phoneNumber: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
            type: zf
              .literal("proxy")
              .register(zf.literal.registry, { hidden: true }),
            url: zf.string().register(zf.string.registry, { label: "URL" }),
          })
          .register(zf.object.registry, { label: "プロキシ" }),
        z
          .object({
            phoneNumber: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
            type: zf
              .literal("scenario")
              .register(zf.literal.registry, { hidden: true }),
            scenarioId: zf
              .string()
              .register(zf.string.registry, { label: "シナリオID" }),
          })
          .register(zf.object.registry, { label: "シナリオ" }),
      ])
      .register(zf.union.registry, {
        label: "発信先タイプ",
        selectorLabel: "タイプ",
      });

    const schema = z
      .object({
        payload: destinationSchema,
      })
      .register(zf.object.registry, { properties: ["payload"] });
    const defaultValues: z.input<typeof schema> = {
      payload: {
        type: "proxy",
        phoneNumber: "09011112222",
        url: "https://example.com",
      },
    };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onChange: schema,
          onBlur: schema,
          onSubmit: schema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              hidden: () => ({ component: HiddenComponent }),
              literal: () => ({ component: LiteralComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Dynamic fieldPath="" schema={schema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    await openAndSelect("シナリオ");

    const phoneInput = await screen.findByDisplayValue("09011112222");
    fireEvent.change(phoneInput, { target: { value: "08099990000" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("08099990000")).toBeTruthy();
    });
  });
});
