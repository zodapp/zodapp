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

const renderForm = (schema: z.ZodTypeAny) => {
  const FormUnderTest = () => {
    const form = useZodForm({ defaultValues: {} });
    return (
      <MantineProvider>
        <I18nMessagesProvider
          locale="en"
          messages={[enMessages, { "test.placeholder.name": "Your name" }]}
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

const findByPlaceholder = (text: string) =>
  waitFor(() => {
    const element = document.querySelector(`[placeholder="${text}"]`);
    expect(element).not.toBeNull();
    return element;
  });

describe("meta の placeholder", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // multiline（Textarea の autosize）は jsdom で描けないので、ここでは確かめない
  it("入力欄に meta の placeholder を出す", async () => {
    const schema = z.object({
      text: zf.string().register(zf.string.registry, {
        placeholder: "text placeholder",
      }),
      password: zf.string().register(zf.string.registry, {
        uiType: "password",
        placeholder: "password placeholder",
      }),
      suggested: zf.string().register(zf.string.registry, {
        suggestions: ["a", "b"],
        placeholder: "suggested placeholder",
      }),
      select: zf.string().register(zf.string.registry, {
        uiType: "select",
        suggestions: ["a", "b"],
        placeholder: "select placeholder",
      }),
      count: zf.number().register(zf.number.registry, {
        placeholder: "number placeholder",
      }),
      big: zf.bigint().register(zf.bigint.registry, {
        placeholder: "bigint placeholder",
      }),
      day: z.iso.date().register(zf.date.registry, {
        placeholder: "date placeholder",
      }),
      color: z
        .enum(["red", "green"])
        .register(zf.enum.registry, { placeholder: "enum placeholder" }),
    });
    renderForm(schema);
    for (const text of [
      "text placeholder",
      "password placeholder",
      "suggested placeholder",
      "select placeholder",
      "number placeholder",
      "bigint placeholder",
      "date placeholder",
      "enum placeholder",
    ]) {
      await findByPlaceholder(text);
    }
  });

  it("msgKey で書くと辞書で訳す", async () => {
    const schema = z.object({
      name: zf.string().register(zf.string.registry, {
        placeholder: encodeMsgKey("test.placeholder.name"),
      }),
    });
    renderForm(schema);
    await findByPlaceholder("Your name");
  });
});
