// @vitest-environment jsdom
import React, { Suspense } from "react";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { MantineProvider } from "@mantine/core";

import { component as ArrayComponent } from "./array";
import { component as OptionalComponent } from "./optional";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import {
  ZodFormContextProvider,
  FormProvider,
  useZodForm,
  Dynamic,
} from "@zodapp/zod-form-react/common";
import { zf } from "@zodapp/zod-form";

describe("ArrayComponent integration (tanstack form)", () => {
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

  it("renders initial array item from defaultValues", async () => {
    const itemSchema = zf
      .object({
        id: zf.string().register(zf.string.registry, { label: "ID" }),
        name: zf.string().register(zf.string.registry, { label: "Name" }),
      })
      .register(zf.object.registry, { label: "Friend" });
    const formSchema = z.object({
      items: zf
        .array(itemSchema)
        .register(zf.array.registry, { label: "Items", discriminator: "id" }),
    });
    type FormData = z.infer<typeof formSchema>;
    const defaultValues: FormData = {
      items: [{ id: "friend-1", name: "initial friend" }],
    };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              string: () => ({ component: StringComponent }),
              object: () => ({ component: ObjectComponent }),
              array: () => ({ component: ArrayComponent }),
            }}
          >
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Dynamic fieldPath="" schema={formSchema} />
                {/* 
              ArrayComponentを直接呼べばテストが通るが、Dynamicで呼ぶとテストが通らない 
              <ArrayComponent
                fieldPath="items"
                schema={formSchema.shape.items}
                required
                readOnly={false}
              /> */}
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    await screen.findByDisplayValue("initial friend");
    await screen.findByDisplayValue("friend-1");
  });

  it("shows validation error for empty array on submit (regression)", async () => {
    const formSchema = z.object({
      items: z.array(z.string()).min(2, "items must have 2"),
    });
    type FormData = z.infer<typeof formSchema>;
    const defaultValues: FormData = { items: [] };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onSubmit: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider componentLibrary={{}}>
            <FormProvider form={form}>
              <ArrayComponent
                fieldPath="items"
                schema={formSchema.shape.items}
                required
                readOnly={false}
              />
              <button onClick={() => form.handleSubmit()}>Submit</button>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    screen.getByText("Submit").click();

    await waitFor(() => {
      expect(screen.queryByText("items must have 2")).not.toBeNull();
    });
  });

  it("shows string validation error on blur after adding item", async () => {
    const formSchema = z.object({
      items: z.array(z.string().min(3, "too short")).min(1, "need one"),
    });
    type FormData = z.infer<typeof formSchema>;
    const defaultValues: FormData = { items: [] };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
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
              <ArrayComponent
                fieldPath="items"
                schema={formSchema.shape.items}
                required
                readOnly={false}
              />
              <button
                onClick={() =>
                  form.setFieldValue("items", (prev: string[] | undefined) => [
                    ...(prev ?? []),
                    "test",
                  ])
                }
              >
                Add
              </button>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    const { container } = render(<FormUnderTest />);

    screen.getByRole("button", { name: "Add" }).click();

    const input = await screen.findByRole("textbox");
    input.focus();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    await waitFor(
      () => {
        expect(
          container.querySelector(".mantine-TextInput-error"),
        ).not.toBeNull();
      },
      { timeout: 1000 },
    );
  });

  it("detects string validation error via mantine error element (sanity)", async () => {
    const formSchema = z.object({
      items: z.array(z.string().min(3, "too short")),
    });
    type FormData = z.infer<typeof formSchema>;
    const defaultValues: FormData = { items: ["a"] };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
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
              <ArrayComponent
                fieldPath="items"
                schema={formSchema.shape.items}
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
    fireEvent.blur(input);

    await waitFor(
      () => {
        expect(
          container.querySelector(".mantine-TextInput-error"),
        ).not.toBeNull();
      },
      { timeout: 1000 },
    );
  });

  it("optional string element should not show required error on blur when empty", async () => {
    const formSchema = z.object({
      items: z.array(
        z.object({
          name: z.string().min(1, "min1").optional(),
        }),
      ),
    });
    type FormData = z.infer<typeof formSchema>;
    const defaultValues: FormData = { items: [{ name: undefined }] };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              string: () => ({ component: StringComponent }),
              object: () => ({ component: ObjectComponent }),
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <ArrayComponent
                fieldPath="items"
                schema={formSchema.shape.items}
                required={false}
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
      expect(container.querySelector(".mantine-TextInput-error")).toBeNull();
    });
  });

  it("optional string element should not show error when cleared after value exists", async () => {
    const formSchema = z.object({
      items: z.array(
        z.object({
          name: z.string().min(1, "min1").optional(),
        }),
      ),
    });
    type FormData = z.infer<typeof formSchema>;
    const defaultValues: FormData = { items: [{ name: "initial" }] };

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues,
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              string: () => ({ component: StringComponent }),
              object: () => ({ component: ObjectComponent }),
              optional: () => ({ component: OptionalComponent }),
            }}
          >
            <FormProvider form={form}>
              <ArrayComponent
                fieldPath="items"
                schema={formSchema.shape.items}
                required={false}
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
      expect(container.querySelector(".mantine-TextInput-error")).toBeNull();
    });
  });
});
