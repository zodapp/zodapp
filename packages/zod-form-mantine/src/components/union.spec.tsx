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

import { readOnlySchemaFieldsExcept, zf } from "@zodapp/zod-form";
import {
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";

import { HiddenComponent } from "@zodapp/zod-form-mantine-lite/baseComponents";
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

describe("UnionComponent top-level discriminatedUnion", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const topLevelSchema = z
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

  const renderTopLevel = (defaultValues: z.input<typeof topLevelSchema>) => {
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onChange: topLevelSchema,
          onBlur: topLevelSchema,
          onSubmit: topLevelSchema,
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
                <Dynamic fieldPath="" schema={topLevelSchema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);
  };

  it("renders top-level discriminatedUnion and can switch discriminator", async () => {
    renderTopLevel({
      type: "proxy",
      phoneNumber: "09011112222",
      url: "https://example.com",
    });

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

  it("keeps common field value after switching discriminator at top level", async () => {
    renderTopLevel({
      type: "proxy",
      phoneNumber: "09011112222",
      url: "https://example.com",
    });

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

  it("allows editing common field after switching discriminator at top level", async () => {
    renderTopLevel({
      type: "proxy",
      phoneNumber: "09011112222",
      url: "https://example.com",
    });

    await openAndSelect("シナリオ");

    const phoneInput = await screen.findByDisplayValue("09011112222");
    fireEvent.change(phoneInput, { target: { value: "08099990000" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("08099990000")).toBeTruthy();
    });
  });

  it("clears selector and branch fields when selecting the current discriminator again", async () => {
    const singleToolSchema = z
      .discriminatedUnion("toolId", [
        z
          .object({
            toolId: zf
              .literal("builtIn-dataSource")
              .register(zf.literal.registry, { hidden: true }),
            outputKey: zf
              .string()
              .register(zf.string.registry, { label: "出力キー" }),
          })
          .register(zf.object.registry, { label: "データソース" }),
      ])
      .register(zf.union.registry, {
        selectorLabel: "ツール種類",
      });

    const schema = z.object({
      payload: singleToolSchema.optional(),
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          payload: undefined,
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
                <Dynamic
                  fieldPath="payload"
                  schema={singleToolSchema}
                  required={false}
                />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    await openAndSelect("データソース");
    expect(await screen.findByRole("textbox", { name: "出力キー" })).toBeTruthy();

    await openAndSelect("データソース");

    await waitFor(() => {
      const selectInput = document.querySelector(
        "input.mantine-Select-input",
      ) as HTMLInputElement | null;
      expect(selectInput?.value).toBe("");
      expect(screen.queryByRole("textbox", { name: "出力キー" })).toBeNull();
    });
  });

  it("keeps selector and branch fields when selecting the current required discriminator again", async () => {
    const singleToolSchema = z
      .discriminatedUnion("toolId", [
        z
          .object({
            toolId: zf
              .literal("builtIn-dataSource")
              .register(zf.literal.registry, { hidden: true }),
            outputKey: zf
              .string()
              .register(zf.string.registry, { label: "出力キー" }),
          })
          .register(zf.object.registry, { label: "データソース" }),
      ])
      .register(zf.union.registry, {
        selectorLabel: "ツール種類",
      });

    const schema = z.object({
      payload: singleToolSchema,
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          payload: { toolId: "builtIn-dataSource", outputKey: "" },
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
                <Dynamic fieldPath="payload" schema={singleToolSchema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    expect(await screen.findByRole("textbox", { name: "出力キー" })).toBeTruthy();
    await openAndSelect("データソース");

    await waitFor(() => {
      const selectInput = document.querySelector(
        "input.mantine-Select-input",
      ) as HTMLInputElement | null;
      expect(selectInput?.value).toBe("データソース");
      expect(screen.getByRole("textbox", { name: "出力キー" })).toBeTruthy();
    });
  });

  it("renders discriminator selector as readonly text while keeping editable fields interactive", async () => {
    const unionSchema = readOnlySchemaFieldsExcept(
      z
        .discriminatedUnion("type", [
          z
            .object({
              type: zf
                .literal("proxy")
                .register(zf.literal.registry, { hidden: true }),
              versionLabel: zf
                .string()
                .register(zf.string.registry, { label: "バージョン名" }),
              url: zf.string().register(zf.string.registry, { label: "URL" }),
            })
            .register(zf.object.registry, { label: "プロキシ" }),
          z
            .object({
              type: zf
                .literal("scenario")
                .register(zf.literal.registry, { hidden: true }),
              versionLabel: zf
                .string()
                .register(zf.string.registry, { label: "バージョン名" }),
              scenarioId: zf
                .string()
                .register(zf.string.registry, { label: "シナリオID" }),
            })
            .register(zf.object.registry, { label: "シナリオ" }),
        ])
        .register(zf.union.registry, {
          label: "発信先タイプ",
          selectorLabel: "タイプ",
        }),
      { paths: ["versionLabel"] },
    );

    const schema = z
      .object({
        payload: unionSchema,
      })
      .register(zf.object.registry, { properties: ["payload"] });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          payload: {
            type: "proxy" as const,
            versionLabel: "v1",
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

    expect(screen.getByText("プロキシ")).toBeTruthy();
    expect(document.querySelector("input.mantine-Select-input")).toBeNull();
    expect(screen.getByRole("textbox", { name: "バージョン名" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();
  });

  it("keeps versionLabel editable while discriminator selector stays readonly", async () => {
    const unionSchema = readOnlySchemaFieldsExcept(
      z
        .discriminatedUnion("type", [
          z
            .object({
              type: zf
                .literal("proxy")
                .register(zf.literal.registry, { hidden: true }),
              versionLabel: zf
                .string()
                .register(zf.string.registry, { label: "バージョン名" }),
              url: zf.string().register(zf.string.registry, { label: "URL" }),
            })
            .register(zf.object.registry, { label: "プロキシ" }),
          z
            .object({
              type: zf
                .literal("scenario")
                .register(zf.literal.registry, { hidden: true }),
              versionLabel: zf
                .string()
                .register(zf.string.registry, { label: "バージョン名" }),
              scenarioId: zf
                .string()
                .register(zf.string.registry, { label: "シナリオID" }),
            })
            .register(zf.object.registry, { label: "シナリオ" }),
        ])
        .register(zf.union.registry, {
          label: "発信先タイプ",
          selectorLabel: "タイプ",
        }),
      { paths: ["versionLabel"] },
    );

    const schema = z
      .object({
        payload: unionSchema,
      })
      .register(zf.object.registry, { properties: ["payload"] });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          payload: {
            type: "proxy" as const,
            versionLabel: "v1",
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

    expect(screen.getByText("プロキシ")).toBeTruthy();
    expect(document.querySelector("input.mantine-Select-input")).toBeNull();
    const versionLabelInput = screen.getByRole("textbox", { name: "バージョン名" });
    fireEvent.change(versionLabelInput, { target: { value: "v2" } });
    await waitFor(() => {
      expect(screen.getByDisplayValue("v2")).toBeTruthy();
    });
    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();
  });
});
