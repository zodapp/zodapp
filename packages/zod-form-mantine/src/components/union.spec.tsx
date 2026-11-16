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
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";

import { HiddenComponent } from "@zodapp/zod-form-mantine-lite/baseComponents";
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
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch
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
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch
                  fieldPath="payload"
                  schema={toolSchema}
                  required={false}
                />
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
    } = {},
  ) => {
    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: {
          ...initialValues,
          ...options.defaultValues,
        } as z.input<typeof schema>,
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
