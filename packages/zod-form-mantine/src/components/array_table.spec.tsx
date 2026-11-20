// @vitest-environment jsdom
import React, { Suspense } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import { encodeMsgKey } from "@zodapp/i18n-messages";
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { componentLibrary } from "./index";
import { en as enMessages } from "../messages";

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

const renderForm = (
  schema: z.ZodTypeAny,
  defaultValues: Record<string, unknown>,
) => {
  const FormUnderTest = () => {
    const form = useZodForm({ defaultValues });
    return (
      <MantineProvider>
        <I18nMessagesProvider
          locale="en"
          messages={[enMessages, { "test.column.name": "Name" }]}
        >
          <ZodFormContextProvider componentLibrary={componentLibrary}>
            <FormProvider form={form}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </I18nMessagesProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
};

describe("array の table の列見出し", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("列の label が辞書のキーなら、訳して出す", async () => {
    const schema = z.object({
      rows: zf
        .array(
          z
            .object({
              name: zf.string().register(zf.string.registry, {
                label: encodeMsgKey("test.column.name"),
              }),
              note: zf
                .string()
                .register(zf.string.registry, { label: "Plain note" }),
            })
            .register(zf.object.registry, {}),
        )
        .register(zf.array.registry, { uiType: "table" }),
    });
    renderForm(schema, { rows: [{ name: "a", note: "b" }] });
    await waitFor(() => {
      const headers = [...document.querySelectorAll("th")].map(
        (th) => th.textContent,
      );
      expect(headers).toContain("Name");
      expect(headers).toContain("Plain note");
      expect(headers).not.toContain("test.column.name");
    });
  });
});
