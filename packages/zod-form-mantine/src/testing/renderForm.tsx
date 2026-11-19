/**
 * テスト用：zod-form-mantine の部品一式（componentLibrary）でフォームを描く。
 * AutoForm と同じく FormRuntime の validator と、前の欄を検証するしくみの中に描く。
 */
import React, { Suspense } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import type { z } from "zod";
import {
  Switch,
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { componentLibrary } from "../components";
import { UnsupportedSchemaNotice } from "../utils/unsupported";

export const setupDomMocks = () => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
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

export const SUBMIT_LABEL = "送信";

/**
 * フォームを描く。`onSubmit` には `runtime.parse` があればその output、無ければフォームの値を渡す
 */
export const renderForm = (
  schema: z.ZodTypeAny,
  defaultValues?: unknown,
  options: { readOnly?: boolean } = {},
) => {
  const runtime = new FormRuntime();
  const validator = runtime.wrapValidator<Record<string, unknown>>(
    schema as never,
  );
  const formRef: { current: AnyFormApi | undefined } = { current: undefined };
  const onSubmit = vi.fn();
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
      validators: {
        onChange: validator,
        onBlur: validator,
        onSubmit: validator,
      },
      onSubmit: ({ value }) => onSubmit(value),
    });
    formRef.current = form as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <ZodFormContextProvider
          componentLibrary={componentLibrary}
          notFoundComponent={UnsupportedSchemaNotice}
        >
          <FormProvider form={form} runtime={runtime}>
            <ValidatePrecedingFieldsProvider>
              <Suspense fallback={null}>
                <Switch
                  fieldPath=""
                  schema={schema}
                  readOnly={options.readOnly}
                />
                <button onClick={() => void form.handleSubmit()}>
                  {SUBMIT_LABEL}
                </button>
              </Suspense>
            </ValidatePrecedingFieldsProvider>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  const { container, unmount } = render(<FormUnderTest />);
  const values = () => formRef.current!.state.values as Record<string, unknown>;
  const submit = () =>
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
  return { container, unmount, formRef, onSubmit, runtime, values, submit };
};
