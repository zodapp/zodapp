// @vitest-environment jsdom
import React, { Suspense } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { readOnlySchemaFieldsExcept, zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  FormRuntime,
  PENDING_ISSUE_CODE,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";

import {
  HiddenComponent,
  LazyComponent,
  NullableComponent,
  OptionalComponent,
} from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as BooleanComponent } from "./boolean";
import { component as EnumComponent } from "./enum";
import { component as LiteralComponent } from "./literal";
import { component as NumberComponent } from "./number";
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
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
          .strict()
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
              .register(zf.string.registry, { label: "シナリオID" })
              .optional(),
          })
          .strict()
          .register(zf.object.registry, { label: "シナリオ" }),
      ])
      .register(zf.union.registry, {
        label: "発信先タイプ",
        selectorLabel: "タイプ",
      });
    const onSubmit = vi.fn();

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
        onSubmit: ({ value }) => onSubmit(value),
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
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

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        payload: {
          type: "scenario",
          phoneNumber: "09011112222",
        },
      });
    });
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
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
        .strict()
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
            .register(zf.string.registry, { label: "シナリオID" })
            .optional(),
        })
        .strict()
        .register(zf.object.registry, { label: "シナリオ" }),
    ])
    .register(zf.union.registry, {
      label: "発信先タイプ",
      selectorLabel: "タイプ",
    });

  const renderTopLevel = (
    defaultValues: z.input<typeof topLevelSchema>,
    onSubmit?: (value: z.output<typeof topLevelSchema>) => void,
  ) => {
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        onSubmit: ({ value }) => onSubmit?.(value),
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={topLevelSchema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
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

  it("redistributes direct discriminatedUnion issues to the selected branch field", async () => {
    const schema = z
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
            scenarioId: z
              .string({ error: "シナリオを選択してください" })
              .register(zf.string.registry, { label: "シナリオID" }),
          })
          .register(zf.object.registry, { label: "シナリオ" }),
      ])
      .register(zf.union.registry, {
        label: "発信先タイプ",
        selectorLabel: "タイプ",
      });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          type: "scenario",
          phoneNumber: "123",
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("シナリオを選択してください")).toBeTruthy();
    });
  });

  it("keeps common field value after switching discriminator at top level", async () => {
    const onSubmit = vi.fn();
    renderTopLevel(
      {
        type: "proxy",
        phoneNumber: "09011112222",
        url: "https://example.com",
      },
      onSubmit,
    );

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

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        type: "scenario",
        phoneNumber: "09011112222",
      });
    });
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch
                  fieldPath="payload"
                  schema={singleToolSchema.optional()}
                />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    await openAndSelect("データソース");
    expect(
      await screen.findByRole("textbox", { name: "出力キー" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();

    await openAndSelect("データソース");

    await waitFor(() => {
      const selectInput = document.querySelector(
        "input.mantine-Select-input",
      ) as HTMLInputElement | null;
      expect(selectInput?.value).toBe("");
      expect(screen.queryByRole("textbox", { name: "出力キー" })).toBeNull();
    });
  });

  it("clears stale validation errors after selecting a discriminator", async () => {
    const toolSchema = z
      .discriminatedUnion("toolId", [
        z
          .object({
            toolId: zf
              .literal("data-source")
              .register(zf.literal.registry, { hidden: true }),
            outputKey: zf
              .string()
              .register(zf.string.registry, { label: "出力キー" }),
          })
          .register(zf.object.registry, { label: "データソースツール" }),
      ])
      .register(zf.union.registry, {
        selectorLabel: "ツール種類",
      });
    const schema = z.object({
      payload: toolSchema.optional(),
    });
    let formRef: Pick<AnyFormApi, "getFieldMeta" | "setFieldMeta"> | undefined;

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: { payload: undefined } as z.input<typeof schema>,
        validators: {
          onChange: schema,
          onBlur: schema,
          onSubmit: schema,
        },
      });
      React.useEffect(() => {
        formRef = form;
      }, [form]);

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              hidden: () => ({ component: HiddenComponent }),
              literal: () => ({ component: LiteralComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="payload" schema={toolSchema.optional()} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);
    formRef?.setFieldMeta("payload", (meta) => ({
      ...meta,
      errorMap: {
        ...meta.errorMap,
        onChange: { message: "必ず入力してください。" },
        onBlur: { message: "必ず入力してください。" },
      },
      errorSourceMap: {
        ...meta.errorSourceMap,
        onChange: "form",
        onBlur: "form",
      },
    }));

    await openAndSelect("データソースツール");

    await waitFor(() => {
      expect(
        formRef?.getFieldMeta("payload")?.errorMap.onChange,
      ).toBeUndefined();
      expect(formRef?.getFieldMeta("payload")?.errorMap.onBlur).toBeUndefined();
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="payload" schema={singleToolSchema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    expect(
      await screen.findByRole("textbox", { name: "出力キー" }),
    ).toBeTruthy();
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
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
              optional: () => ({ component: OptionalComponent }),
            }}
          >
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

    expect(screen.getByText("プロキシ")).toBeTruthy();
    expect(document.querySelector("input.mantine-Select-input")).toBeNull();
    const versionLabelInput = screen.getByRole("textbox", {
      name: "バージョン名",
    });
    fireEvent.change(versionLabelInput, { target: { value: "v2" } });
    await waitFor(() => {
      expect(screen.getByDisplayValue("v2")).toBeTruthy();
    });
    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();
  });
});

describe("UnionComponent union without discriminator", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // form-demo の zf.union のページと同じ形：文字列の腕と、literal の type を持つ object の腕
  const contactSchema = zf
    .union([
      z
        .email("有効なメールアドレスを入力してください")
        .register(zf.string.registry, { label: "メールアドレス" }),
      zf
        .object({
          type: zf
            .literal("phone")
            .register(zf.literal.registry, { hidden: true }),
          phone: zf
            .string()
            .min(10, "10桁以上で入力してください")
            .register(zf.string.registry, { label: "電話番号" }),
        })
        .register(zf.object.registry, { label: "電話" }),
      zf
        .object({
          type: zf
            .literal("address")
            .register(zf.literal.registry, { hidden: true }),
          address: zf.string().register(zf.string.registry, { label: "住所" }),
        })
        .register(zf.object.registry, { label: "住所" }),
    ])
    .register(zf.union.registry, {
      label: "連絡先",
      selectorLabel: "連絡先タイプ",
    });

  const schema = z
    .object({ contact: contactSchema })
    .register(zf.object.registry, { properties: ["contact"] });

  const renderPlainUnion = (
    defaultValues: unknown,
    options: {
      onSubmit?: (value: unknown) => void;
      formRef?: { current: AnyFormApi | undefined };
    } = {},
  ) => {
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: defaultValues as z.input<typeof schema>,
        onSubmit: ({ value }) => options.onSubmit?.(value),
        validators: {
          onChange: schema,
          onBlur: schema,
          onSubmit: schema,
        },
      });
      if (options.formRef) {
        options.formRef.current = form as unknown as AnyFormApi;
      }

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              hidden: () => ({ component: HiddenComponent }),
              literal: () => ({ component: LiteralComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };
    return render(<FormUnderTest />);
  };

  const selectorValue = () =>
    (
      document.querySelector(
        "input.mantine-Select-input",
      ) as HTMLInputElement | null
    )?.value;

  it("shows the fields of an object arm right after selecting it", async () => {
    renderPlainUnion({ contact: "user@example.com" });
    expect(screen.getByDisplayValue("user@example.com")).toBeTruthy();

    await openAndSelect("電話");

    await waitFor(() => {
      expect(selectorValue()).toBe("電話");
      expect(screen.getByRole("textbox", { name: "電話番号" })).toBeTruthy();
    });
    expect(screen.queryByDisplayValue("user@example.com")).toBeNull();
  });

  it("keeps the selected arm while its fields are partially filled", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPlainUnion({ contact: "user@example.com" }, { formRef });

    await openAndSelect("電話");
    const phone = await screen.findByRole("textbox", { name: "電話番号" });
    fireEvent.change(phone, { target: { value: "090" } });

    await waitFor(() => {
      expect(formRef.current?.state.values).toEqual({
        contact: { type: "phone", phone: "090" },
      });
    });
    expect(selectorValue()).toBe("電話");
    expect(screen.getByRole("textbox", { name: "電話番号" })).toBeTruthy();
  });

  it("can switch back to the string arm", async () => {
    renderPlainUnion({ contact: "user@example.com" });

    await openAndSelect("電話");
    await screen.findByRole("textbox", { name: "電話番号" });
    await openAndSelect("メールアドレス");

    await waitFor(() => {
      expect(selectorValue()).toBe("メールアドレス");
      // 腕の欄はラベルなしで描画される（union の Fieldset がラベルを持つ）
      expect(screen.getAllByRole("textbox")).toHaveLength(1);
    });
    expect(screen.queryByRole("textbox", { name: "電話番号" })).toBeNull();
  });

  it("does not show errors right after switching arms", async () => {
    renderPlainUnion({ contact: "user@example.com" });

    await openAndSelect("電話");
    await screen.findByRole("textbox", { name: "電話番号" });

    expect(screen.queryByText("10桁以上で入力してください")).toBeNull();
  });

  it("shows the selected arm's errors on submit", async () => {
    const onSubmit = vi.fn();
    renderPlainUnion({ contact: "user@example.com" }, { onSubmit });

    await openAndSelect("電話");
    const phone = await screen.findByRole("textbox", { name: "電話番号" });
    fireEvent.change(phone, { target: { value: "090" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("10桁以上で入力してください")).toBeTruthy();
    });
    expect(selectorValue()).toBe("電話");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("follows the value when it is changed from outside to another arm", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPlainUnion({ contact: "user@example.com" }, { formRef });

    await openAndSelect("電話");
    await screen.findByRole("textbox", { name: "電話番号" });

    formRef.current?.setFieldValue("contact", {
      type: "address",
      address: "東京都",
    });

    await waitFor(() => {
      expect(selectorValue()).toBe("住所");
      expect(screen.getByDisplayValue("東京都")).toBeTruthy();
    });
  });

  it("guesses the arm from its literal field when the initial value fits no arm", async () => {
    renderPlainUnion({ contact: { type: "phone" } });

    await waitFor(() => {
      expect(selectorValue()).toBe("電話");
      expect(screen.getByRole("textbox", { name: "電話番号" })).toBeTruthy();
    });
  });

  it("leaves the selector empty when no arm can be determined", async () => {
    renderPlainUnion({ contact: { type: "fax" } });

    await waitFor(() => {
      expect(document.querySelector("input.mantine-Select-input")).toBeTruthy();
    });
    expect(selectorValue()).toBe("");
    expect(screen.queryByRole("textbox", { name: "電話番号" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "住所" })).toBeNull();
  });
});

describe("UnionComponent union of primitive arms", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // form-demo の zf.union（いろいろな腕）のページと同じ形
  const schema = z
    .object({
      // 文字列・数値・オブジェクト
      value: zf
        .union([
          zf
            .string()
            .min(3, "3文字以上で入力してください")
            .register(zf.string.registry, { label: "文字列" }),
          zf
            .number()
            .multipleOf(5, "5の倍数で入力してください")
            .register(zf.number.registry, { label: "数値" }),
          zf
            .object({
              text: zf.string().register(zf.string.registry, { label: "本文" }),
            })
            .register(zf.object.registry, { label: "オブジェクト" }),
        ])
        .register(zf.union.registry, {
          label: "値",
          selectorLabel: "値の種類",
        }),
      // どちらの腕にも通る値（"S"・"M"・"L"）がある
      size: zf
        .union([
          zf
            .enum([
              zf.literal("S").register(zf.literal.registry, { label: "S" }),
              zf.literal("M").register(zf.literal.registry, { label: "M" }),
              zf.literal("L").register(zf.literal.registry, { label: "L" }),
            ])
            .register(zf.enum.registry, { label: "選ぶ" }),
          zf.string().register(zf.string.registry, { label: "自由に書く" }),
        ])
        .register(zf.union.registry, {
          label: "サイズ",
          selectorLabel: "サイズの決め方",
        }),
      // 真偽値・literal
      answer: zf
        .union([
          zf.boolean().register(zf.boolean.registry, { label: "はい・いいえ" }),
          zf
            .literal("unknown")
            .register(zf.literal.registry, { label: "わからない" }),
        ])
        .register(zf.union.registry, {
          label: "回答",
          selectorLabel: "回答のしかた",
        }),
    })
    .register(zf.object.registry, {
      properties: ["value", "size", "answer"],
    });

  type Values = { value: unknown; size: unknown; answer: unknown };
  const initialValues: Values = { value: "123", size: "M", answer: true };

  const renderPrimitiveUnion = (
    options: {
      defaultValues?: Partial<Values>;
      onSubmit?: (value: unknown) => void;
      formRef?: { current: AnyFormApi | undefined };
      /** AutoForm と同じく、validator を FormRuntime で包む */
      withRuntime?: boolean;
    } = {},
  ) => {
    const runtime = new FormRuntime();
    const validator = options.withRuntime
      ? runtime.wrapValidator<z.input<typeof schema>>(schema)
      : schema;
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          ...initialValues,
          ...options.defaultValues,
        } as z.input<typeof schema>,
        onSubmit: ({ value }) => options.onSubmit?.(value),
        validators: {
          onChange: validator,
          onBlur: validator,
          onSubmit: validator,
        },
      });
      if (options.formRef) {
        options.formRef.current = form as unknown as AnyFormApi;
      }

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              boolean: () => ({ component: BooleanComponent }),
              enum: () => ({ component: EnumComponent }),
              hidden: () => ({ component: HiddenComponent }),
              literal: () => ({ component: LiteralComponent }),
              number: () => ({ component: NumberComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
            }}
          >
            <FormProvider form={form} runtime={runtime}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };
    return render(<FormUnderTest />);
  };

  /** union の枠（Fieldset の legend が union のラベル） */
  const group = (label: string) => screen.getByRole("group", { name: label });

  /** 腕を選ぶ欄（枠の中の最初の Select） */
  const selectorOf = (label: string) =>
    group(label).querySelector(
      "input.mantine-Select-input",
    ) as HTMLInputElement;

  /** 腕の欄（プリミティブの腕はラベルなしで描かれるので、枠の中の最後の入力欄） */
  const armInputOf = (label: string) => {
    const inputs = group(label).querySelectorAll<HTMLInputElement>(
      "input:not([type=hidden])",
    );
    return inputs[inputs.length - 1]!;
  };

  const selectArm = async (label: string, optionLabel: string) => {
    const selector = selectorOf(label);
    fireEvent.click(selector);
    fireEvent.focus(selector);
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", { name: optionLabel, hidden: true }),
    );
    await waitFor(() => expect(selectorOf(label).value).toBe(optionLabel));
  };

  it("switches string → number → object → string → number and writes the value in the arm's type", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPrimitiveUnion({ formRef });
    const value = () => formRef.current?.state.values.value;

    await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));
    expect(armInputOf("値").value).toBe("123");

    await selectArm("値", "数値");
    // "123" は数値の腕に通らないので、数値の腕の既定の値（空）になる
    expect(value()).toBeUndefined();
    expect(armInputOf("値").value).toBe("");
    fireEvent.change(armInputOf("値"), { target: { value: "15" } });
    await waitFor(() => expect(value()).toBe(15));

    await selectArm("値", "オブジェクト");
    const text = within(group("値")).getByRole("textbox", { name: "本文" });
    fireEvent.change(text, { target: { value: "本文です" } });
    await waitFor(() => expect(value()).toEqual({ text: "本文です" }));

    await selectArm("値", "文字列");
    expect(
      within(group("値")).queryByRole("textbox", { name: "本文" }),
    ).toBeNull();
    fireEvent.change(armInputOf("値"), { target: { value: "456" } });
    await waitFor(() => expect(value()).toBe("456"));

    await selectArm("値", "数値");
    fireEvent.change(armInputOf("値"), { target: { value: "20" } });
    await waitFor(() => expect(value()).toBe(20));
    expect(selectorOf("値").value).toBe("数値");
  });

  it("keeps a number-like string in the string arm while typing", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPrimitiveUnion({ formRef });

    await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));
    fireEvent.change(armInputOf("値"), { target: { value: "4242" } });

    await waitFor(() => {
      expect(formRef.current?.state.values.value).toBe("4242");
    });
    expect(selectorOf("値").value).toBe("文字列");
  });

  it("opens a value that fits both arms in the first arm, and keeps the chosen arm for such values", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPrimitiveUnion({ formRef });

    // "M" は「選ぶ」にも「自由に書く」にも通る。先の腕で開く
    await waitFor(() => expect(selectorOf("サイズ").value).toBe("選ぶ"));

    await selectArm("サイズ", "自由に書く");
    // "M" は自由に書くにも通るので、値はそのまま
    expect(formRef.current?.state.values.size).toBe("M");
    expect(armInputOf("サイズ").value).toBe("M");

    // "S" も両方の腕に通るが、選んだ腕のまま
    fireEvent.change(armInputOf("サイズ"), { target: { value: "S" } });
    await waitFor(() => {
      expect(formRef.current?.state.values.size).toBe("S");
    });
    expect(selectorOf("サイズ").value).toBe("自由に書く");
  });

  it("switches between boolean and literal arms", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPrimitiveUnion({ formRef });

    await waitFor(() => expect(selectorOf("回答").value).toBe("はい・いいえ"));
    expect(
      (within(group("回答")).getByRole("switch") as HTMLInputElement).checked,
    ).toBe(true);

    await selectArm("回答", "わからない");
    expect(formRef.current?.state.values.answer).toBe("unknown");
    expect(within(group("回答")).getByText("unknown")).toBeTruthy();

    await selectArm("回答", "はい・いいえ");
    fireEvent.click(within(group("回答")).getByRole("switch"));
    await waitFor(() => {
      expect(formRef.current?.state.values.answer).toBe(true);
    });
    expect(selectorOf("回答").value).toBe("はい・いいえ");
  });

  it("follows primitive values written from outside", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderPrimitiveUnion({ formRef });
    await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));

    formRef.current?.setFieldValue("value", 10);
    await waitFor(() => {
      expect(selectorOf("値").value).toBe("数値");
      expect(armInputOf("値").value).toBe("10");
    });

    formRef.current?.setFieldValue("value", { text: "外から" });
    await waitFor(() => {
      expect(selectorOf("値").value).toBe("オブジェクト");
      expect(screen.getByDisplayValue("外から")).toBeTruthy();
    });

    formRef.current?.setFieldValue("value", "外からの文字列");
    await waitFor(() => {
      expect(selectorOf("値").value).toBe("文字列");
      expect(armInputOf("値").value).toBe("外からの文字列");
    });
  });

  it("shows the number arm's error on submit", async () => {
    const onSubmit = vi.fn();
    renderPrimitiveUnion({ onSubmit });
    await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));

    await selectArm("値", "数値");
    fireEvent.change(armInputOf("値"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(
        within(group("値")).getByText("5の倍数で入力してください"),
      ).toBeTruthy();
    });
    expect(selectorOf("値").value).toBe("数値");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the string arm's error on submit", async () => {
    const onSubmit = vi.fn();
    renderPrimitiveUnion({ onSubmit });
    await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));

    fireEvent.change(armInputOf("値"), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(
        within(group("値")).getByText("3文字以上で入力してください"),
      ).toBeTruthy();
    });
    // 選んだ腕に通らなくなっても、腕は保たれる
    expect(selectorOf("値").value).toBe("文字列");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // 空の数値の腕は、どの腕にも型が合わない（invalid_union）。腕のエラーの path は [] で、union 自身を指す
  describe.each([
    { name: "schema passed directly to useZodForm", withRuntime: false },
    {
      name: "validator wrapped with FormRuntime (as AutoForm)",
      withRuntime: true,
    },
  ])("value that fits no arm's type ($name)", ({ withRuntime }) => {
    it("shows the selected arm's error on the empty number arm on submit", async () => {
      const onSubmit = vi.fn();
      renderPrimitiveUnion({ onSubmit, withRuntime });
      await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));

      await selectArm("値", "数値");
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => {
        expect(
          within(group("値")).getByText(
            "Invalid input: expected number, received undefined",
          ),
        ).toBeTruthy();
      });
      expect(selectorOf("値").value).toBe("数値");
      expect(onSubmit).not.toHaveBeenCalled();
      // union 自身の総称の文言は、腕の欄に重ねて出さない
      expect(within(group("値")).queryByText("Invalid input")).toBeNull();
    });

    it("clears the arm's error once a valid value is typed", async () => {
      renderPrimitiveUnion({ withRuntime });
      await waitFor(() => expect(selectorOf("値").value).toBe("文字列"));

      await selectArm("値", "数値");
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await within(group("値")).findByText(
        "Invalid input: expected number, received undefined",
      );

      fireEvent.change(armInputOf("値"), { target: { value: "15" } });
      await waitFor(() => {
        expect(
          within(group("値")).queryByText(
            "Invalid input: expected number, received undefined",
          ),
        ).toBeNull();
      });
    });
  });

  it("leaves the selector empty when a primitive initial value fits no arm", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    // "ab" は文字列の腕（3文字以上）にも、ほかの腕にも通らず、literal の欄も無い
    renderPrimitiveUnion({ formRef, defaultValues: { value: "ab" } });

    await waitFor(() => expect(selectorOf("サイズ").value).toBe("選ぶ"));
    expect(selectorOf("値").value).toBe("");
    expect(
      group("値").querySelectorAll("input:not([type=hidden])"),
    ).toHaveLength(1);
    // 開いただけでは値を書き換えない
    expect(formRef.current?.state.values.value).toBe("ab");
  });
});

describe("UnionComponent optional・nullable・required union without discriminator", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const textOrNumber = (label: string) =>
    zf
      .union([
        zf.string().register(zf.string.registry, { label: "文字" }),
        zf.number().register(zf.number.registry, { label: "数" }),
      ])
      .register(zf.union.registry, {
        label,
        selectorLabel: `${label}の種類`,
      });

  // form-demo の zf.union（いろいろな腕）のページの メモ・備考・必須の値 と同じ形
  const schema = z
    .object({
      memo: textOrNumber("メモ").optional(),
      note: textOrNumber("備考").nullable(),
      required: textOrNumber("必須"),
    })
    .register(zf.object.registry, { properties: ["memo", "note", "required"] });

  type Values = { memo?: unknown; note: unknown; required?: unknown };

  const renderForm = (
    options: {
      defaultValues?: Partial<Values>;
      onSubmit?: (value: unknown) => void;
      formRef?: { current: AnyFormApi | undefined };
    } = {},
  ) => {
    const runtime = new FormRuntime();
    const validator = runtime.wrapValidator<z.input<typeof schema>>(schema);
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          memo: undefined,
          note: null,
          required: undefined,
          ...options.defaultValues,
        } as z.input<typeof schema>,
        onSubmit: ({ value }) => options.onSubmit?.(value),
        validators: {
          onChange: validator,
          onBlur: validator,
          onSubmit: validator,
        },
      });
      if (options.formRef) {
        options.formRef.current = form as unknown as AnyFormApi;
      }
      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              hidden: () => ({ component: HiddenComponent }),
              nullable: () => ({ component: NullableComponent }),
              number: () => ({ component: NumberComponent }),
              object: () => ({ component: ObjectComponent }),
              optional: () => ({ component: OptionalComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
            }}
          >
            <FormProvider form={form} runtime={runtime}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };
    return render(<FormUnderTest />);
  };

  const group = (label: string) => screen.getByRole("group", { name: label });
  const selectorOf = (label: string) =>
    group(label).querySelector(
      "input.mantine-Select-input",
    ) as HTMLInputElement;
  /** 腕の欄（腕を選ぶ欄のほかの入力欄） */
  const armInputsOf = (label: string) =>
    Array.from(
      group(label).querySelectorAll<HTMLInputElement>(
        "input:not([type=hidden]):not(.mantine-Select-input)",
      ),
    );
  /** 腕を選ぶ欄の × */
  const clearButtonOf = (label: string) => {
    const wrapper = selectorOf(label).closest(".mantine-InputWrapper-root");
    return wrapper?.querySelector("button") as HTMLButtonElement | null;
  };
  const selectArm = async (label: string, optionLabel: string) => {
    const selector = selectorOf(label);
    fireEvent.click(selector);
    fireEvent.focus(selector);
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    // 腕を選ぶ欄が複数あるので、この欄の選択肢の一覧から選ぶ
    const listbox = await waitFor(() => {
      const id = selector.getAttribute("aria-controls");
      const element = id ? document.getElementById(id) : null;
      expect(element).toBeTruthy();
      return element!;
    });
    fireEvent.click(
      within(listbox).getByRole("option", { name: optionLabel, hidden: true }),
    );
    await waitFor(() => expect(selectorOf(label).value).toBe(optionLabel));
  };
  const values = (formRef: { current: AnyFormApi | undefined }) =>
    formRef.current?.state.values as Values;

  describe("optional union", () => {
    it("clears the selected arm and the value with ×", async () => {
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      renderForm({ formRef });
      await waitFor(() => expect(selectorOf("メモ").value).toBe(""));

      await selectArm("メモ", "数");
      fireEvent.change(armInputsOf("メモ")[0]!, { target: { value: "5" } });
      await waitFor(() => expect(values(formRef).memo).toBe(5));

      const clear = clearButtonOf("メモ");
      expect(clear).toBeTruthy();
      fireEvent.click(clear!);

      await waitFor(() => {
        expect(selectorOf("メモ").value).toBe("");
        expect(armInputsOf("メモ")).toHaveLength(0);
      });
      expect(values(formRef).memo).toBeUndefined();
    });

    it("can be submitted after clearing", async () => {
      const onSubmit = vi.fn();
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      renderForm({
        onSubmit,
        formRef,
        defaultValues: { memo: 5, required: "x" },
      });
      await waitFor(() => expect(selectorOf("メモ").value).toBe("数"));

      fireEvent.click(clearButtonOf("メモ")!);
      await waitFor(() => expect(selectorOf("メモ").value).toBe(""));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({
        memo: undefined,
        note: null,
        required: "x",
      });
    });
  });

  describe("optional and nullable union", () => {
    it("writes undefined (not null) when an arm is picked empty and with ×", async () => {
      const both = z
        .object({
          both: textOrNumber("両方").optional().nullable(),
        })
        .register(zf.object.registry, { properties: ["both"] });
      const runtime = new FormRuntime();
      const validator = runtime.wrapValidator<z.input<typeof both>>(both);
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const FormUnderTest = () => {
        const form = useZodForm({
          defaultValues: { both: null } as z.input<typeof both>,
          validators: { onChange: validator, onSubmit: validator },
        });
        formRef.current = form as unknown as AnyFormApi;
        return (
          <MantineProvider>
            <ZodFormContextProvider
              componentLibrary={{
                nullable: () => ({ component: NullableComponent }),
                number: () => ({ component: NumberComponent }),
                object: () => ({ component: ObjectComponent }),
                optional: () => ({ component: OptionalComponent }),
                string: () => ({ component: StringComponent }),
                union: () => ({ component: UnionComponent }),
              }}
            >
              <FormProvider form={form} runtime={runtime}>
                <Suspense fallback={null}>
                  <Switch fieldPath="" schema={both} />
                </Suspense>
              </FormProvider>
            </ZodFormContextProvider>
          </MantineProvider>
        );
      };
      render(<FormUnderTest />);
      await waitFor(() => expect(selectorOf("両方").value).toBe(""));

      await selectArm("両方", "文字");
      expect(
        (formRef.current!.state.values as { both?: unknown }).both,
      ).toBeUndefined();

      fireEvent.change(armInputsOf("両方")[0]!, { target: { value: "a" } });
      await waitFor(() =>
        expect((formRef.current!.state.values as { both?: unknown }).both).toBe(
          "a",
        ),
      );
      fireEvent.click(clearButtonOf("両方")!);
      await waitFor(() => expect(selectorOf("両方").value).toBe(""));
      expect(
        (formRef.current!.state.values as { both?: unknown }).both,
      ).toBeUndefined();
    });
  });

  describe("required union", () => {
    /** 腕を選ぶ欄の下のエラー */
    const selectorErrorOf = (label: string) =>
      selectorOf(label)
        .closest(".mantine-InputWrapper-root")
        ?.querySelector(".mantine-InputWrapper-error")?.textContent ?? null;

    it("shows 選択してください on the selector when submitted with no arm selected", async () => {
      const onSubmit = vi.fn();
      renderForm({ onSubmit });
      await waitFor(() => expect(selectorOf("必須").value).toBe(""));
      // 開いただけではエラーを出さない
      expect(selectorErrorOf("必須")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() =>
        expect(selectorErrorOf("必須")).toBe("選択してください"),
      );
      expect(onSubmit).not.toHaveBeenCalled();
      // optional・nullable の union は、空のままでもエラーを出さない
      expect(selectorErrorOf("メモ")).toBeNull();
      expect(selectorErrorOf("備考")).toBeNull();
    });

    it("shows 選択してください when the value fits no arm and no arm can be guessed", async () => {
      renderForm({ defaultValues: { required: true } });
      await waitFor(() => expect(selectorOf("必須").value).toBe(""));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() =>
        expect(selectorErrorOf("必須")).toBe("選択してください"),
      );
    });

    it("moves the error from the selector to the arm once an arm is selected", async () => {
      renderForm({});
      await waitFor(() => expect(selectorOf("必須").value).toBe(""));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() =>
        expect(selectorErrorOf("必須")).toBe("選択してください"),
      );

      await selectArm("必須", "数");
      await waitFor(() => expect(selectorErrorOf("必須")).toBeNull());

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(
          within(group("必須")).getByText(
            "Invalid input: expected number, received undefined",
          ),
        ).toBeTruthy();
      });
      expect(selectorErrorOf("必須")).toBeNull();
    });
  });
  describe("nullable union", () => {
    it("keeps null when an arm is picked, and can be submitted with the arm left empty", async () => {
      const onSubmit = vi.fn();
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      renderForm({ onSubmit, formRef, defaultValues: { required: "x" } });
      await waitFor(() => expect(selectorOf("備考").value).toBe(""));

      await selectArm("備考", "文字");
      expect(values(formRef).note).toBeNull();
      expect(armInputsOf("備考")).toHaveLength(1);
      expect(armInputsOf("備考")[0]!.value).toBe("");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ note: null });
      // 送信しても、選んだ腕は保たれる
      expect(selectorOf("備考").value).toBe("文字");
    });

    it("goes back to null with ×", async () => {
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      renderForm({ formRef });
      await waitFor(() => expect(selectorOf("備考").value).toBe(""));

      await selectArm("備考", "数");
      fireEvent.change(armInputsOf("備考")[0]!, { target: { value: "7" } });
      await waitFor(() => expect(values(formRef).note).toBe(7));

      fireEvent.click(clearButtonOf("備考")!);
      await waitFor(() => {
        expect(selectorOf("備考").value).toBe("");
        expect(armInputsOf("備考")).toHaveLength(0);
      });
      expect(values(formRef).note).toBeNull();
    });
  });
});

describe("UnionComponent arm errors written to the union's own field", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const NUMBER_ERROR = "Invalid input: expected number, received undefined";
  const STRING_ERROR = "Invalid input: expected string, received undefined";

  const innerUnion = () =>
    zf
      .union([
        zf.string().register(zf.string.registry, { label: "文字列" }),
        zf.number().register(zf.number.registry, { label: "数値" }),
      ])
      .register(zf.union.registry, {
        label: "内側",
        selectorLabel: "内側の種類",
      });

  /**
   * 値：数値 | (文字列 | 数値) | オブジェクト。2 つめの腕は、同じ欄に描かれる union。
   * `lazy` は、2 つめの腕を `z.lazy(() => zf.union(...))`（呼ぶたびに別の union を作る）にする
   */
  const makeSchema = (lazy: boolean) =>
    z
      .object({
        value: zf
          .union([
            zf.number().register(zf.number.registry, { label: "外の数値" }),
            lazy ? z.lazy(() => innerUnion()) : innerUnion(),
            zf
              .object({
                text: zf
                  .string()
                  .register(zf.string.registry, { label: "本文" }),
              })
              .register(zf.object.registry, { label: "オブジェクト" }),
          ])
          .register(zf.union.registry, {
            label: "値",
            selectorLabel: "値の種類",
          }),
      })
      .register(zf.object.registry, { properties: ["value"] });

  const renderForm = (options: {
    lazy?: boolean;
    /** makeSchema の代わりに使う schema（欄 value を持つ object） */
    schema?: z.ZodTypeAny;
    withRuntime?: boolean;
    formRef: { current: AnyFormApi | undefined };
    onSubmit?: (value: unknown) => void;
    defaultValue?: unknown;
  }) => {
    const schema = (options.schema ??
      makeSchema(options.lazy ?? false)) as ReturnType<typeof makeSchema>;
    const runtime = new FormRuntime();
    const validator = options.withRuntime
      ? runtime.wrapValidator<z.input<typeof schema>>(schema)
      : schema;
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: (options.defaultValue ?? { value: 1 }) as z.input<
          typeof schema
        >,
        onSubmit: ({ value }) => options.onSubmit?.(value),
        validators: {
          onChange: validator,
          onBlur: validator,
          onSubmit: validator,
        },
      });
      options.formRef.current = form as unknown as AnyFormApi;
      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              boolean: () => ({ component: BooleanComponent }),
              hidden: () => ({ component: HiddenComponent }),
              lazy: () => ({ component: LazyComponent }),
              literal: () => ({ component: LiteralComponent }),
              number: () => ({ component: NumberComponent }),
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              union: () => ({ component: UnionComponent }),
            }}
          >
            <FormProvider form={form} runtime={runtime}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>Submit</button>
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };
    return render(<FormUnderTest />);
  };

  const group = () => screen.getByRole("group", { name: "値" });
  /** 腕を選ぶ欄（外側から順） */
  const selectors = () =>
    Array.from(
      group().querySelectorAll<HTMLInputElement>("input.mantine-Select-input"),
    );
  /** 腕の欄（腕を選ぶ欄のほかの入力欄） */
  const armInputs = () =>
    Array.from(
      group().querySelectorAll<HTMLInputElement>(
        "input:not([type=hidden]):not(.mantine-Select-input)",
      ),
    );
  const selectArm = async (index: number, optionLabel: string) => {
    const selector = selectors()[index]!;
    fireEvent.click(selector);
    fireEvent.focus(selector);
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    const listbox = await waitFor(() => {
      const id = selector.getAttribute("aria-controls");
      const element = id ? document.getElementById(id) : null;
      expect(element).toBeTruthy();
      return element!;
    });
    fireEvent.click(
      within(listbox).getByRole("option", { name: optionLabel, hidden: true }),
    );
    await waitFor(() =>
      expect(selectors()[index]!.value.trim()).toBe(optionLabel),
    );
  };
  /** union が書いた枠 */
  const armSlot = (formRef: { current: AnyFormApi | undefined }) =>
    (
      formRef.current?.getFieldMeta("value")?.errorMap as Record<
        string,
        unknown
      >
    )?.onDynamic as { message?: string; code?: string }[] | undefined;
  /** 落ち着いたあと、store が書き換わり続けない（描き直しが止まる）ことを確かめる */
  const expectSettled = async (formRef: {
    current: AnyFormApi | undefined;
  }) => {
    let updates = 0;
    const subscription = formRef.current!.store.subscribe(() => {
      updates += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    subscription.unsubscribe();
    expect(updates).toBe(0);
    const errorCalls = (
      console.error as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls;
    expect(
      errorCalls.some((call) =>
        String(call[0]).includes("Maximum update depth"),
      ),
    ).toBe(false);
  };

  describe.each([
    { name: "schema passed directly", withRuntime: false },
    { name: "FormRuntime", withRuntime: true },
  ])("first submit right after switching arms ($name)", ({ withRuntime }) => {
    it("validates on the first submit after picking the outer and the inner arm", async () => {
      // 腕を選ぶ欄を離れると、フォーム全体の onBlur の検証が走り、その結果（フォーム全体のエラー）が残る。
      // 腕を選ぶと値を検証せずに書くので、そのエラーが残ったままだと canSubmit が false になり、
      // TanStack Form は初めの送信を検証せずに止める
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: { text: "本文" } },
      });
      await waitFor(() => expect(selectors()[0]!.value).toBe("オブジェクト"));
      await selectArm(0, "内側");
      await waitFor(() => expect(selectors()).toHaveLength(2));
      await selectArm(1, "数値");
      expect(formRef.current?.state.values.value).toBeUndefined();

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe.each([
    { name: "union arm", lazy: false, armLabel: "内側" },
    {
      name: "z.lazy arm creating a new union on each call",
      lazy: true,
      armLabel: "2",
    },
  ])("nested union at the same path ($name)", ({ lazy, armLabel }) => {
    describe.each([
      { name: "schema passed directly", withRuntime: false },
      { name: "FormRuntime", withRuntime: true },
    ])("$name", ({ withRuntime }) => {
      it("shows the inner arm's error on the inner arm's input, without a loop, and clears it after fixing", async () => {
        const formRef: { current: AnyFormApi | undefined } = {
          current: undefined,
        };
        const onSubmit = vi.fn();
        renderForm({
          lazy,
          withRuntime,
          formRef,
          onSubmit,
          defaultValue: { value: { text: "本文" } },
        });
        await waitFor(() => expect(selectors()[0]!.value).toBe("オブジェクト"));

        await selectArm(0, armLabel);
        await waitFor(() => expect(selectors()).toHaveLength(2));
        await selectArm(1, "数値");
        expect(formRef.current?.state.values.value).toBeUndefined();

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));
        await waitFor(() => {
          expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
        });
        // 内側の union の腕（数値）のエラーだけ。外側の腕（外の数値）や内側の別の腕（文字列）のものは出さない
        expect(within(group()).getAllByText(NUMBER_ERROR)).toHaveLength(1);
        expect(within(group()).queryByText(STRING_ERROR)).toBeNull();
        expect(armInputs()).toHaveLength(1);
        expect(armInputs()[0]!.getAttribute("aria-invalid")).toBe("true");
        expect(onSubmit).not.toHaveBeenCalled();

        // invalid_union は欄に残り、外側の union が内側の invalid_union を、内側の union が腕のエラーを足している
        const errors = formRef.current!.getFieldMeta("value")!.errors as {
          code?: string;
        }[];
        expect(errors.some((issue) => issue.code === "invalid_union")).toBe(
          true,
        );
        const slot = armSlot(formRef)!;
        expect(slot.map((issue) => issue.code).sort()).toEqual([
          "invalid_type",
          "invalid_union",
        ]);
        await expectSettled(formRef);

        fireEvent.change(armInputs()[0]!, { target: { value: "12" } });
        await waitFor(() => {
          expect(within(group()).queryByText(NUMBER_ERROR)).toBeNull();
        });
        expect(armSlot(formRef)).toBeUndefined();
        expect(armInputs()[0]!.getAttribute("aria-invalid")).not.toBe("true");
        await expectSettled(formRef);

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]![0]).toEqual({ value: 12 });
      });
    });
  });

  it("shows the arm's error with the error style (via wrapComponent) and stops re-rendering", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderForm({ formRef, withRuntime: true });
    await waitFor(() => expect(selectors()[0]!.value).toBe("外の数値"));

    // 外の数値の腕を空にする（どの腕にも型が合わない）
    fireEvent.change(armInputs()[0]!, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
    });
    const input = armInputs()[0]!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.hasAttribute("data-error")).toBe(true);
    await expectSettled(formRef);
  });

  it("writes and shows the arm's error only after the field is touched or the form is submitted", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderForm({ formRef, withRuntime: true });
    await waitFor(() => expect(selectors()[0]!.value).toBe("外の数値"));

    // 触っていない欄に、検証だけで invalid_union を出す
    formRef.current!.setFieldValue("value", undefined as never, {
      dontUpdateMeta: true,
      dontValidate: true,
    });
    formRef.current!.setFieldMeta("value", (meta) => ({
      ...meta,
      isTouched: false,
    }));
    await formRef.current!.validate("change");
    await waitFor(() => {
      const errors = formRef.current!.getFieldMeta("value")!.errors as {
        code?: string;
      }[];
      expect(errors.some((issue) => issue.code === "invalid_union")).toBe(true);
    });
    await expectSettled(formRef);
    expect(within(group()).queryByText(NUMBER_ERROR)).toBeNull();
    expect(armSlot(formRef)).toBeUndefined();

    // 触ったら出す
    fireEvent.blur(armInputs()[0]!);
    await waitFor(() => {
      expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
    });
    expect(armSlot(formRef)).toHaveLength(1);
  });

  it("finds invalid_union even when a pending issue comes first in the field's errors", async () => {
    const formRef: { current: AnyFormApi | undefined } = { current: undefined };
    renderForm({ formRef, withRuntime: true });
    await waitFor(() => expect(selectors()[0]!.value).toBe("外の数値"));

    // 読み込み中の印を、欄のエラーの先頭に置く（ほかの枠より先に並ぶ枠に入れる。
    // onMount は値を書くと TanStack が消すので、onServer を使う）
    formRef.current!.setFieldMeta("value", (meta) => ({
      ...meta,
      errorMap: {
        onServer: [
          { code: PENDING_ISSUE_CODE, message: "読み込み中", path: ["value"] },
        ],
        ...Object.fromEntries(
          Object.entries(meta.errorMap ?? {}).filter(
            ([key]) => key !== "onServer",
          ),
        ),
      },
    }));
    // 空にして、どの腕にも型が合わない値にする（触った扱いになり、onChange で検証する）
    fireEvent.change(armInputs()[0]!, { target: { value: "" } });

    await waitFor(() => {
      expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
    });
    const errors = formRef.current!.getFieldMeta("value")!.errors as {
      code?: string;
    }[];
    expect(errors.map((issue) => issue.code)).toEqual([
      PENDING_ISSUE_CODE,
      "invalid_union",
      "invalid_type",
    ]);
    expect(within(group()).queryByText("読み込み中")).toBeNull();
    await expectSettled(formRef);
  });

  const BOOLEAN_ERROR = "Invalid input: expected boolean, received undefined";

  /**
   * 欄の枠（onDynamic）に書かれたことのある文言をすべて集める。
   * store が変わるたびに読むので、描き直しの間の一瞬の取り違えも拾う
   */
  const recordSlotMessages = (
    formRef: { current: AnyFormApi | undefined },
    fieldName = "value",
  ) => {
    const seen = new Set<string>();
    const subscription = formRef.current!.store.subscribe(() => {
      const slot = (
        formRef.current!.getFieldMeta(fieldName)?.errorMap as
          | Record<string, unknown>
          | undefined
      )?.onDynamic;
      (Array.isArray(slot) ? slot : []).forEach((issue) => {
        const message = (issue as { message?: unknown } | undefined)?.message;
        if (typeof message === "string") seen.add(message);
      });
    });
    return { seen, stop: () => subscription.unsubscribe() };
  };

  describe.each([
    { name: "schema passed directly", withRuntime: false },
    { name: "FormRuntime", withRuntime: true },
  ])("which invalid_union each union reads ($name)", ({ withRuntime }) => {
    it("never lets the inner union read the outer union's issue, even for one render (same arm count)", async () => {
      // 外側も内側も腕が 2 つ。内側が外側の invalid_union を読むと、外側の 1 つめの腕（文字列）の文言を腕の欄に書く
      const schema = z
        .object({
          value: zf
            .union([
              zf.string().register(zf.string.registry, { label: "外の文字列" }),
              zf
                .union([
                  zf
                    .number()
                    .register(zf.number.registry, { label: "内の数値" }),
                  zf
                    .boolean()
                    .register(zf.boolean.registry, { label: "内の真偽" }),
                ])
                .register(zf.union.registry, {
                  label: "内側",
                  selectorLabel: "内側の種類",
                }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: "abc" },
      });
      await waitFor(() => expect(selectors()[0]!.value).toBe("外の文字列"));
      await selectArm(0, "内側");
      await waitFor(() => expect(selectors()).toHaveLength(2));
      await selectArm(1, "内の数値");
      expect(formRef.current?.state.values.value).toBeUndefined();

      const recorder = recordSlotMessages(formRef);
      fireEvent.blur(armInputs()[0]!);
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
      });
      await expectSettled(formRef);
      recorder.stop();

      expect(recorder.seen.has(NUMBER_ERROR)).toBe(true);
      expect(recorder.seen.has(STRING_ERROR)).toBe(false);
      expect(within(group()).queryByText(STRING_ERROR)).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shows the arm's error of three unions stacked on the same field, and clears it after fixing", async () => {
      // 外側（文字列 | 中）→ 中（真偽 | 内）→ 内（数値 | 文字列）。どれも同じ欄 value に描かれる
      const schema = z
        .object({
          value: zf
            .union([
              zf.string().register(zf.string.registry, { label: "外の文字列" }),
              zf
                .union([
                  zf
                    .boolean()
                    .register(zf.boolean.registry, { label: "中の真偽" }),
                  zf
                    .union([
                      zf
                        .number()
                        .register(zf.number.registry, { label: "内の数値" }),
                      zf
                        .string()
                        .register(zf.string.registry, { label: "内の文字列" }),
                    ])
                    .register(zf.union.registry, {
                      label: "内側",
                      selectorLabel: "内側の種類",
                    }),
                ])
                .register(zf.union.registry, {
                  label: "中",
                  selectorLabel: "中の種類",
                }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: "abc" },
      });
      await waitFor(() => expect(selectors()[0]!.value).toBe("外の文字列"));
      await selectArm(0, "中");
      // 中の既定の値によっては、中がすでに内側を選んでいる
      await waitFor(() => expect(selectors().length).toBeGreaterThanOrEqual(2));
      if (selectors()[1]!.value !== "内側") await selectArm(1, "内側");
      await waitFor(() => expect(selectors()).toHaveLength(3));
      await selectArm(2, "内の数値");
      expect(formRef.current?.state.values.value).toBeUndefined();

      const recorder = recordSlotMessages(formRef);
      fireEvent.blur(armInputs()[0]!);
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
      });
      expect(within(group()).getAllByText(NUMBER_ERROR)).toHaveLength(1);
      expect(armInputs()).toHaveLength(1);
      expect(armInputs()[0]!.getAttribute("aria-invalid")).toBe("true");
      // 外側・中が、それぞれ腕の union の invalid_union を、内側が腕のエラーを書いている
      expect(
        armSlot(formRef)!
          .map((issue) => issue.code)
          .sort(),
      ).toEqual(["invalid_type", "invalid_union", "invalid_union"]);
      await expectSettled(formRef);
      recorder.stop();
      // 外側の腕（文字列）・中の腕（真偽）の文言を、どの union も読み違えない
      expect(recorder.seen.has(STRING_ERROR)).toBe(false);
      expect(recorder.seen.has(BOOLEAN_ERROR)).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.change(armInputs()[0]!, { target: { value: "12" } });
      await waitFor(() => {
        expect(within(group()).queryByText(NUMBER_ERROR)).toBeNull();
      });
      expect(armSlot(formRef)).toBeUndefined();
      await expectSettled(formRef);

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0]).toEqual({ value: 12 });
    });

    it("lets a plain union in a child field of a discriminatedUnion read the validator's issue at its own path", async () => {
      // 外側の discriminatedUnion（欄 value）が、子の欄 value.amount に discriminator のない union を持つ
      const schema = z
        .object({
          value: z
            .discriminatedUnion("kind", [
              zf
                .object({
                  kind: zf
                    .literal("a")
                    .register(zf.literal.registry, { hidden: true }),
                  amount: zf
                    .union([
                      zf
                        .number()
                        .register(zf.number.registry, { label: "金額の数値" }),
                      zf
                        .boolean()
                        .register(zf.boolean.registry, { label: "金額の真偽" }),
                    ])
                    .register(zf.union.registry, {
                      label: "金額",
                      selectorLabel: "金額の種類",
                    }),
                })
                .register(zf.object.registry, { label: "A" }),
              zf
                .object({
                  kind: zf
                    .literal("b")
                    .register(zf.literal.registry, { hidden: true }),
                  note: zf
                    .string()
                    .register(zf.string.registry, { label: "備考" }),
                })
                .register(zf.object.registry, { label: "B" }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: { kind: "a", amount: 5 } },
      });
      const amountGroup = () => screen.getByRole("group", { name: "金額" });
      const amountInput = () =>
        amountGroup().querySelector<HTMLInputElement>(
          "input:not([type=hidden]):not(.mantine-Select-input)",
        )!;
      await waitFor(() => expect(selectors()).toHaveLength(2));
      await waitFor(() => expect(selectors()[1]!.value).toBe("金額の数値"));

      // 子の欄を空にする（どの腕にも型が合わない。invalid_union は value.amount の欄に、印なしで出る）
      fireEvent.change(amountInput(), { target: { value: "" } });
      fireEvent.blur(amountInput());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(within(amountGroup()).getByText(NUMBER_ERROR)).toBeTruthy();
      });
      expect(amountInput().getAttribute("aria-invalid")).toBe("true");
      expect(within(amountGroup()).queryByText(BOOLEAN_ERROR)).toBeNull();
      const slot = (
        formRef.current!.getFieldMeta("value.amount")?.errorMap as Record<
          string,
          unknown
        >
      )?.onDynamic as { code?: string }[] | undefined;
      expect(slot?.map((issue) => issue.code)).toEqual(["invalid_type"]);
      await expectSettled(formRef);
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.change(amountInput(), { target: { value: "7" } });
      await waitFor(() => {
        expect(within(amountGroup()).queryByText(NUMBER_ERROR)).toBeNull();
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0]).toEqual({
        value: { kind: "a", amount: 7 },
      });
    });

    it("delivers invalid_union to a union in a child field of an object arm of a plain union", async () => {
      // 外側の discriminator のない union（欄 value）の object の腕が、子の欄 value.inner に union を持つ。
      // 検証の invalid_union は value の欄に出て、value.inner の分は外側の union が振り分ける
      const schema = z
        .object({
          value: zf
            .union([
              zf.string().register(zf.string.registry, { label: "外の文字列" }),
              zf
                .object({
                  inner: zf
                    .union([
                      zf
                        .number()
                        .register(zf.number.registry, { label: "中の数値" }),
                      zf
                        .boolean()
                        .register(zf.boolean.registry, { label: "中の真偽" }),
                    ])
                    .register(zf.union.registry, {
                      label: "中",
                      selectorLabel: "中の種類",
                    }),
                })
                .register(zf.object.registry, { label: "オブジェクト" }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: { inner: 5 } },
      });
      const innerGroup = () => screen.getByRole("group", { name: "中" });
      const innerInput = () =>
        innerGroup().querySelector<HTMLInputElement>(
          "input:not([type=hidden]):not(.mantine-Select-input)",
        )!;
      await waitFor(() => expect(selectors()).toHaveLength(2));
      await waitFor(() => expect(selectors()[1]!.value).toBe("中の数値"));

      fireEvent.change(innerInput(), { target: { value: "" } });
      fireEvent.blur(innerInput());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(within(innerGroup()).getByText(NUMBER_ERROR)).toBeTruthy();
      });
      expect(innerInput().getAttribute("aria-invalid")).toBe("true");
      // 振り分けた issue は、code と errors を落とさない
      const slot = (
        formRef.current!.getFieldMeta("value.inner")?.errorMap as Record<
          string,
          unknown
        >
      )?.onDynamic as { code?: string; errors?: unknown }[] | undefined;
      expect(slot?.map((issue) => issue.code)).toEqual([
        "invalid_union",
        "invalid_type",
      ]);
      expect(Array.isArray(slot?.[0]?.errors)).toBe(true);
      await expectSettled(formRef);
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.change(innerInput(), { target: { value: "7" } });
      await waitFor(() => {
        expect(within(innerGroup()).queryByText(NUMBER_ERROR)).toBeNull();
      });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0]).toEqual({ value: { inner: 7 } });
    });

    it("shows 選択してください on a required discriminatedUnion with no arm selected, and writes nothing to non-existent fields", async () => {
      // discriminatedUnion は、値が undefined のとき invalid_union ではなく invalid_type を union の欄に出す
      const schema = z
        .object({
          value: z
            .discriminatedUnion("kind", [
              zf
                .object({
                  kind: zf
                    .literal("a")
                    .register(zf.literal.registry, { hidden: true }),
                  note: zf
                    .string()
                    .register(zf.string.registry, { label: "備考" }),
                })
                .register(zf.object.registry, { label: "A" }),
              zf
                .object({
                  kind: zf
                    .literal("b")
                    .register(zf.literal.registry, { hidden: true }),
                  amount: zf
                    .number()
                    .register(zf.number.registry, { label: "金額" }),
                })
                .register(zf.object.registry, { label: "B" }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: undefined },
      });
      const selectorError = () =>
        selectors()[0]!
          .closest(".mantine-InputWrapper-root")
          ?.querySelector(".mantine-InputWrapper-error")?.textContent ?? null;
      await waitFor(() => expect(selectors()[0]!.value).toBe(""));
      expect(selectorError()).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(selectorError()).toBe("選択してください"));
      expect(onSubmit).not.toHaveBeenCalled();
      // union の欄の issue（path は絶対）を、相対の path として子の欄（value.value）に書かない
      expect(Object.keys(formRef.current!.state.fieldMeta)).not.toContain(
        "value.value",
      );
      await expectSettled(formRef);

      await selectArm(0, "A");
      await waitFor(() => expect(selectorError()).toBeNull());
    });

    it("shows 選択してください on a discriminatedUnion whose saved value has no discriminator", async () => {
      // discriminator のない保存値では、zod は invalid_union を [union の欄, discriminator] に出す。
      // その欄は描かれないので、union が読んで腕を選ぶ欄に出す
      const schema = z
        .object({
          value: z
            .discriminatedUnion("kind", [
              zf
                .object({
                  kind: zf
                    .literal("a")
                    .register(zf.literal.registry, { hidden: true }),
                  note: zf
                    .string()
                    .register(zf.string.registry, { label: "備考" }),
                })
                .register(zf.object.registry, { label: "A" }),
              zf
                .object({
                  kind: zf
                    .literal("b")
                    .register(zf.literal.registry, { hidden: true }),
                  amount: zf
                    .number()
                    .register(zf.number.registry, { label: "金額" }),
                })
                .register(zf.object.registry, { label: "B" }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: { note: "古い値" } as never },
      });
      const selectorError = () =>
        selectors()[0]!
          .closest(".mantine-InputWrapper-root")
          ?.querySelector(".mantine-InputWrapper-error")?.textContent ?? null;
      await waitFor(() => expect(selectors()[0]!.value).toBe(""));
      expect(selectorError()).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(selectorError()).toBe("選択してください"));
      expect(onSubmit).not.toHaveBeenCalled();
      await expectSettled(formRef);

      await selectArm(0, "A");
      await waitFor(() => expect(selectorError()).toBeNull());
    });

    it("clears the child field's error as soon as it is fixed, without leaving the field", async () => {
      // object の腕の子の欄に型のエラー（空の数値）があると、zod は union の欄に invalid_union を出す。
      // 欄を離れたときの検証の結果（union の欄の onBlur）が残ると、直しても子の欄にエラーが出続けていた
      const schema = z
        .object({
          value: zf
            .union([
              zf.string().register(zf.string.registry, { label: "外の文字列" }),
              zf
                .object({
                  amount: zf
                    .number()
                    .register(zf.number.registry, { label: "金額" }),
                })
                .register(zf.object.registry, { label: "オブジェクト" }),
            ])
            .register(zf.union.registry, {
              label: "値",
              selectorLabel: "値の種類",
            }),
        })
        .register(zf.object.registry, { properties: ["value"] });
      const formRef: { current: AnyFormApi | undefined } = {
        current: undefined,
      };
      const onSubmit = vi.fn();
      renderForm({
        schema,
        withRuntime,
        formRef,
        onSubmit,
        defaultValue: { value: { amount: 5 } },
      });
      const amountInput = () =>
        screen.getByRole("textbox", { name: "金額" }) as HTMLInputElement;
      await waitFor(() => expect(selectors()[0]!.value).toBe("オブジェクト"));

      fireEvent.change(amountInput(), { target: { value: "" } });
      fireEvent.blur(amountInput());
      // 1 回目の送信は、欄を離れたときの検証のエラーがあるので TanStack Form が止める。2 回目で検証する
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(within(group()).getByText(NUMBER_ERROR)).toBeTruthy();
      });
      expect(
        formRef.current!.getFieldMeta("value")?.errorMap?.onBlur,
      ).toBeTruthy();

      // 欄を離れずに直す
      fireEvent.change(amountInput(), { target: { value: "7" } });
      await waitFor(() => {
        expect(within(group()).queryByText(NUMBER_ERROR)).toBeNull();
      });
      expect(
        formRef.current!.getFieldMeta("value")?.errorMap?.onBlur,
      ).toBeUndefined();
      await expectSettled(formRef);
    });
  });
});
