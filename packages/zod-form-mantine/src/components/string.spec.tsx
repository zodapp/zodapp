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

import { component as StringComponent } from "./string";
import {
  ZodFormContextProvider,
  FormProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";

describe("StringComponent sanity", () => {
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

  it("shows required error on blur when empty", async () => {
    const formSchema = z.object({
      name: z.string().min(1, "required"),
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: { name: "" } as z.infer<typeof formSchema>,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              string: () => ({ component: StringComponent }),
            }}
          >
            <FormProvider form={form}>
              <StringComponent
                fieldPath="name"
                schema={formSchema.shape.name}
                required
                readOnly={false}
              />
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    const { container } = render(<FormUnderTest />);

    const input = await screen.findByRole("textbox");
    input.focus();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        container.querySelector(".mantine-TextInput-error"),
      ).not.toBeNull();
    });
  });

  it("shows required error after clearing value", async () => {
    const formSchema = z.object({
      name: z.string().min(1, "required"),
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: { name: "initial" } as z.infer<typeof formSchema>,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              string: () => ({ component: StringComponent }),
            }}
          >
            <FormProvider form={form}>
              <StringComponent
                fieldPath="name"
                schema={formSchema.shape.name}
                required
                readOnly={false}
              />
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    const { container } = render(<FormUnderTest />);

    const input = await screen.findByRole("textbox");
    input.focus();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        container.querySelector(".mantine-TextInput-error"),
      ).not.toBeNull();
    });
  });
});
