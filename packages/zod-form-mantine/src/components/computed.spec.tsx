// @vitest-environment jsdom
import React, { Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import type { RegisteredResolverContext } from "@zodapp/zod-form/resolverContext/types";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { OptionalComponent } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ComputedComponent } from "./computed";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as NumberComponent } from "./number";

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

const componentLibrary = {
  optional: () => ({ component: OptionalComponent }),
  computed: () => ({ component: ComputedComponent }),
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  number: () => ({ component: NumberComponent }),
};

const renderForm = (
  schema: z.ZodTypeAny,
  defaultValues: unknown,
  options: { resolverContext?: RegisteredResolverContext } = {},
) => {
  let formApi: AnyFormApi | undefined;
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
    });
    formApi = form as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <ZodFormContextProvider
          componentLibrary={componentLibrary}
          resolverContext={options.resolverContext}
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
  return () => formApi!;
};

describe("computed", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("値を持つ欄では、自分の値から表示を作る", async () => {
    const schema = z.object({
      price: zf.number().register(zf.computed.registry, {
        compute: ({ value }) => `${value} 円`,
      }),
    });
    const form = renderForm(schema, { price: 100 });
    expect(await screen.findByText("100 円")).toBeTruthy();
    act(() => form().setFieldValue("price", 200));
    expect(await screen.findByText("200 円")).toBeTruthy();
  });

  it("dependsOnParent: true なら親の値を受け取り、兄弟の変更で呼び直す", async () => {
    const schema = z.object({
      first: zf.string().register(zf.string.registry, { label: "名" }),
      last: zf.string().register(zf.string.registry, { label: "姓" }),
      full: zf
        .computed()
        .register(zf.computed.registry, {
          dependsOnParent: true,
          compute: ({ parent }) => `${parent.last} ${parent.first}`,
        }),
    });
    const form = renderForm(schema, { first: "太郎", last: "山田" });
    expect(await screen.findByText("山田 太郎")).toBeTruthy();
    act(() => form().setFieldValue("first", "次郎"));
    expect(await screen.findByText("山田 次郎")).toBeTruthy();
  });

  it("dependsOnParent を書かなければ parent は渡さず、兄弟の変更では呼ばない", async () => {
    const compute = vi.fn(({ parent }: { parent: unknown }) =>
      parent === undefined ? "親なし" : "親あり",
    );
    const schema = z.object({
      first: zf.string().register(zf.string.registry, { label: "名" }),
      note: zf.computed().register(zf.computed.registry, { compute }),
    });
    const form = renderForm(schema, { first: "太郎" });
    expect(await screen.findByText("親なし")).toBeTruthy();
    const calls = compute.mock.calls.length;
    act(() => form().setFieldValue("first", "次郎"));
    await waitFor(() => expect(screen.getByDisplayValue("次郎")).toBeTruthy());
    expect(compute.mock.calls.length).toBe(calls);
  });

  it("dependsOnValue: false なら自分の値が変わっても呼び直さない", async () => {
    const compute = vi.fn(({ value }: { value: unknown }) => `値 ${value}`);
    const schema = z.object({
      price: zf.number().register(zf.computed.registry, {
        dependsOnValue: false,
        compute,
      }),
    });
    const form = renderForm(schema, { price: 100 });
    expect(await screen.findByText("値 100")).toBeTruthy();
    const calls = compute.mock.calls.length;
    act(() => form().setFieldValue("price", 200));
    expect(screen.getByText("値 100")).toBeTruthy();
    expect(compute.mock.calls.length).toBe(calls);
  });

  it("contextId を指定すると resolverContext の該当部分を context として渡す", async () => {
    const schema = z.object({
      who: zf
        .computed()
        .register(zf.computed.registry, {
          contextId: "auth",
          compute: ({ context }) =>
            `${(context as { userName: string }).userName} さんとして編集しています`,
        }),
    });
    renderForm(
      schema,
      {},
      {
        resolverContext: {
          auth: { userName: "山田" },
        } as unknown as RegisteredResolverContext,
      },
    );
    expect(
      await screen.findByText("山田 さんとして編集しています"),
    ).toBeTruthy();
  });
});
