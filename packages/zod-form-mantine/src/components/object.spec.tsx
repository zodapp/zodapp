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
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";

import { OptionalComponent } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";

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

const patternSchema = z
  .strictObject({
    source: zf.string().register(zf.string.registry, { label: "パターン" }),
    flags: zf
      .string()
      .register(zf.string.registry, { label: "フラグ" })
      .optional(),
  })
  .register(zf.object.registry, {
    label: "正規表現",
    properties: ["source", "flags"],
    uiType: "box",
  });

const formSchema = z
  .object({
    pattern: patternSchema.optional(),
  })
  .register(zf.object.registry, { properties: ["pattern"] });

type FormValues = z.input<typeof formSchema>;

describe("ObjectComponent optional (0..1) UI", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createFormUnderTest = (options?: {
    defaultValues?: FormValues;
    readOnly?: boolean;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formRef: { current: any } = { current: undefined };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: options?.defaultValues ?? ({} as FormValues),
        validators: {
          onChange: formSchema,
          onBlur: formSchema,
          onSubmit: formSchema,
        },
      });
      React.useEffect(() => {
        formRef.current = form;
      }, [form]);

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              object: () => ({ component: ObjectComponent }),
              string: () => ({ component: StringComponent }),
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch
                  fieldPath=""
                  schema={formSchema}
                  readOnly={options?.readOnly}
                />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    return {
      FormUnderTest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getForm: () => formRef.current as any,
    };
  };

  it("shows only add button when value is undefined", async () => {
    const { FormUnderTest } = createFormUnderTest();
    render(<FormUnderTest />);

    expect(
      await screen.findByRole("button", { name: "追加" }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });

  it("adds object value with defaults and renders inner fields on add", async () => {
    const { FormUnderTest, getForm } = createFormUnderTest();
    render(<FormUnderTest />);

    fireEvent.click(await screen.findByRole("button", { name: "追加" }));

    await waitFor(() => {
      expect(screen.queryAllByRole("textbox").length).toBeGreaterThan(0);
      const values = getForm().state.values as FormValues;
      expect(values.pattern).toBeTruthy();
      expect(typeof values.pattern).toBe("object");
    });
    expect(screen.queryByRole("button", { name: "追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "削除" })).toBeTruthy();
  });

  it("clears value back to undefined on remove", async () => {
    const { FormUnderTest, getForm } = createFormUnderTest({
      defaultValues: { pattern: { source: "^abc$", flags: "i" } },
    });
    render(<FormUnderTest />);

    // 初期値ありなので入力と削除ボタンが見える
    const sourceInput = (await screen.findAllByRole("textbox"))[0];
    expect((sourceInput as HTMLInputElement).value).toBe("^abc$");

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      const values = getForm().state.values as FormValues;
      expect(values.pattern).toBeUndefined();
      expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    });
    expect(screen.queryByRole("button", { name: "追加" })).toBeTruthy();
  });

  it("hides add/remove buttons when readOnly", async () => {
    const { FormUnderTest } = createFormUnderTest({
      defaultValues: { pattern: { source: "^abc$" } },
      readOnly: true,
    });
    render(<FormUnderTest />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "追加" })).toBeNull();
      expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
    });
  });
});
