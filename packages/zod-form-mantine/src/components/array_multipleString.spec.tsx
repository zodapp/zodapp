// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";

import {
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { zf } from "@zodapp/zod-form";
import { component as ArrayOfStringComponent } from "./array_multipleString";

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

describe("ArrayOfStringComponent", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("ignores non-string placeholder values before passing them to TagsInput", async () => {
    const formSchema = z.object({
      tags: zf
        .array(zf.string())
        .min(1)
        .register(zf.array.registry, {
          label: "タグ",
          uiType: "multipleString",
        }),
    });

    const FormUnderTest = () => {
      const form = useZodForm({
        defaultValues: { tags: [undefined] as unknown as string[] },
        validators: {
          onBlur: formSchema,
        },
      });

      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={{
              array_multipleString: () => ({
                component: ArrayOfStringComponent,
              }),
            }}
          >
            <FormProvider form={form}>
              <ArrayOfStringComponent
                fieldPath="tags"
                schema={formSchema.shape.tags}
                required
                readOnly={false}
              />
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };

    render(<FormUnderTest />);

    expect(await screen.findByPlaceholderText("タグを入力してEnterで追加")).toBeTruthy();
  });
});
