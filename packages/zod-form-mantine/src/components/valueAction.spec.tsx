// @vitest-environment jsdom
import React, { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
  type ValueActionResolver,
} from "@zodapp/zod-form-react/common";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as StringSelectComponent } from "./string_select";
import { component as EnumComponent } from "./enum";

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
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  string_select: () => ({ component: StringSelectComponent }),
  enum: () => ({ component: EnumComponent }),
};

// 操作の設定から、値を書いたリンクで包む
const valueActionResolver: ValueActionResolver = ({ value, actionConfig }) => {
  const params = actionConfig.getActionParams({ value, context: undefined });
  return (children) => (
    <a data-testid="value-action" href={`/items/${String(params.id)}`}>
      {children}
    </a>
  );
};

const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
    });
    return (
      <MantineProvider>
        <ZodFormContextProvider
          componentLibrary={componentLibrary}
          valueActionResolver={valueActionResolver}
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
  return render(<FormUnderTest />);
};

const action = {
  getActionParams: ({ value }: { value: string }) => ({ id: value }),
};

describe("string の選択式と値ごとの操作", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uiType: "select" の string は suggestions のラベルで選んだ値を表示する', async () => {
    const schema = z.object({
      office: zf.string().register(zf.string.registry, {
        label: "拠点",
        uiType: "select",
        suggestions: [
          { label: "東京本社", value: "hq" },
          { label: "大阪支社", value: "osaka" },
        ],
      }),
    });
    renderForm(schema, { office: "osaka" });
    expect(await screen.findByDisplayValue("大阪支社")).toBeTruthy();
  });

  it('uiType: "select" の string は、選択肢に無い保存値もそのまま表示する', async () => {
    const schema = z.object({
      office: zf.string().register(zf.string.registry, {
        label: "拠点",
        uiType: "select",
        suggestions: [{ label: "東京本社", value: "hq" }],
      }),
    });
    renderForm(schema, { office: "closed-branch" });
    expect(
      (await screen.findAllByDisplayValue("closed-branch")).length,
    ).toBeGreaterThan(0);
  });

  it("string の valueAction は、値があるときだけ操作のリンクを出す", async () => {
    const schema = z.object({
      owner: zf.string().register(zf.string.registry, {
        label: "担当",
        valueAction: action,
      }),
      empty: zf.string().register(zf.string.registry, {
        label: "空",
        valueAction: action,
      }),
    });
    renderForm(schema, { owner: "u1" });
    const links = await screen.findAllByTestId("value-action");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("/items/u1");
  });

  it("enum の valueAction も操作のリンクを出す", async () => {
    const schema = z.object({
      status: zf
        .enum([zf.literal("open"), zf.literal("closed")])
        .register(zf.enum.registry, { label: "状態", valueAction: action }),
    });
    renderForm(schema, { status: "open" });
    const link = await screen.findByTestId("value-action");
    expect(link.getAttribute("href")).toBe("/items/open");
  });
});
