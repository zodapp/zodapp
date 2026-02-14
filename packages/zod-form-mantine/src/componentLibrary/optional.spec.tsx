// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";

import { component as OptionalComponent } from "./optional";
import { component as StringComponent } from "./string";
import {
  ZodFormContextProvider,
  FormProvider,
  useZodForm,
  LazyProvider,
} from "@zodapp/zod-form-react/common";

describe("OptionalComponent integration", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("optional string should not show required error on blur when empty", async () => {
    const formSchema = z.object({
      opt: z.string().min(1, "min1").optional(),
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: { opt: undefined } as z.infer<typeof formSchema>,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <LazyProvider
          lazyFactory={(importFn) => {
            const res = importFn();
            if ("component" in res) {
              return res.component;
            }
            // fallback for Promise-like
            throw new Error("unexpected lazy factory resolution");
          }}
        >
          <MantineProvider>
            <ZodFormContextProvider
              componentLibrary={{
                string: () => ({ component: StringComponent }),
                optional: () => ({ component: OptionalComponent }),
              }}
            >
              <FormProvider form={form}>
                <OptionalComponent
                  fieldPath="opt"
                  schema={formSchema.shape.opt}
                  required={false}
                  readOnly={false}
                />
              </FormProvider>
            </ZodFormContextProvider>
          </MantineProvider>
        </LazyProvider>
      );
    };

    const { container } = render(<FormUnderTest />);

    const input = await screen.findByRole("textbox");
    input.focus();
    input.blur();

    await waitFor(() => {
      // 現状の不具合: optional なのに空で blur するとエラーが出る
      expect(container.querySelector(".mantine-TextInput-error")).toBeNull();
    });
  });

  it("optional string in form schema (web reproducer) should not show error when cleared", async () => {
    const formSchema = z.object({
      firstName: z.string().min(1, "min1").optional(),
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: { firstName: "initial" } as z.infer<typeof formSchema>,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <LazyProvider
          lazyFactory={(importFn) => {
            const res = importFn();
            if ("component" in res) {
              return res.component;
            }
            throw new Error("unexpected lazy factory resolution");
          }}
        >
          <MantineProvider>
            <ZodFormContextProvider
              componentLibrary={{
                string: () => ({ component: StringComponent }),
                optional: () => ({ component: OptionalComponent }),
              }}
            >
              <FormProvider form={form}>
                <OptionalComponent
                  fieldPath="firstName"
                  schema={formSchema.shape.firstName}
                  required={false}
                  readOnly={false}
                />
              </FormProvider>
            </ZodFormContextProvider>
          </MantineProvider>
        </LazyProvider>
      );
    };

    const { container } = render(<FormUnderTest />);

    const input = await screen.findByRole("textbox");
    input.focus();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => {
      // 本来は optional なのでエラーが出ないはず（現在は出てしまう不具合）
      expect(container.querySelector(".mantine-TextInput-error")).toBeNull();
    });
  });
});
