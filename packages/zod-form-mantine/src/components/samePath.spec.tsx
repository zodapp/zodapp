// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 実験 1（同じ path の受け渡し）の確認用テスト。
 *
 * dynamic の欄に外側の包み（optional・nullable・default・refine）を付けたとき、
 * その包みがフォームの検証で効くかを確かめる。
 */
import React, { Suspense } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { zf, defineDynamicMeta, getMeta } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as DynamicComponent } from "./dynamic";
import { component as TupleComponent } from "./tuple";

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
  ...baseComponents,
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  dynamic: () => ({ component: DynamicComponent }),
  tuple: () => ({ component: TupleComponent }),
};

/** 同期で z.string().min(1) に決まる dynamic。base は静的な検証で使う schema */
const dyn = <T extends z.ZodTypeAny>(base: T) =>
  (base as z.ZodTypeAny).register(
    zf.dynamic.registry,
    defineDynamicMeta({
      resolve: () => ({
        key: "fixed",
        schema: z.string().min(1, "内側の必須"),
      }),
    }) as any,
  ) as unknown as T;

const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const runtime = new FormRuntime();
  const validator = runtime.wrapValidator<any>(schema);
  const onSubmit = vi.fn();
  let form: AnyFormApi | undefined;
  const FormUnderTest = () => {
    const f = useZodForm({
      defaultValues: defaultValues as any,
      validators: { onChange: validator, onSubmit: validator },
      onSubmit: ({ value }) => onSubmit(value),
    });
    form = f as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <ZodFormContextProvider componentLibrary={componentLibrary as any}>
          <FormProvider form={f as any} runtime={runtime}>
            <Suspense fallback={null}>
              <Switch fieldPath="" schema={schema} />
            </Suspense>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
  const submit = async () => {
    await act(async () => {
      await form!.handleSubmit();
    });
  };
  const messagesAt = (path: string) =>
    runtime
      .validate(schema, form!.state.values)
      .filter((issue) => issue.path.join(".") === path)
      .map((issue) => issue.message);
  return { getForm: () => form!, runtime, onSubmit, submit, messagesAt };
};

const object = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).register(zf.object.registry, {
    properties: Object.keys(shape),
  } as any);

describe("同じ path の外側の包み（dynamic）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("refine したあとも dynamic の meta が引ける（前提の確認）", () => {
    const schema = dyn(z.string()).refine((v) => v !== "bad");
    expect(getMeta(schema, "dynamic")?.resolve).toBeTypeOf("function");
  });

  it("外側の .refine() のエラーが、dynamic の欄に出て送信が止まる", async () => {
    const schema = object({
      x: dyn(z.string()).refine((v) => v !== "bad", "外のrefine"),
    });
    const { submit, onSubmit, messagesAt } = renderForm(schema, { x: "bad" });
    await submit();
    expect(messagesAt("x")).toContain("外のrefine");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("optional の中の .refine() も効き、undefined は通る", async () => {
    const schema = object({
      x: dyn(z.string())
        .refine((v) => v !== "bad", "外のrefine")
        .optional(),
    });
    const r1 = renderForm(schema, { x: "bad" });
    await r1.submit();
    expect(r1.messagesAt("x")).toContain("外のrefine");
    cleanup();
    const r2 = renderForm(schema, { x: undefined });
    await r2.submit();
    expect(r2.messagesAt("x")).toEqual([]);
    expect(r2.onSubmit).toHaveBeenCalled();
  });

  it("外側の .default() があれば、値が無くても送信できる", async () => {
    const schema = object({ x: dyn(z.string()).default("d") });
    const { submit, onSubmit, messagesAt } = renderForm(schema, {
      x: undefined,
    });
    await submit();
    expect(messagesAt("x")).toEqual([]);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("外側の .optional() があれば、値が無くても送信できる", async () => {
    const schema = object({ x: dyn(z.string()).optional() });
    const { submit, onSubmit } = renderForm(schema, { x: undefined });
    await submit();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("外側の .nullable() があれば、null でも送信できる", async () => {
    const schema = object({ x: dyn(z.string()).nullable() });
    const { submit, onSubmit } = renderForm(schema, { x: null });
    await submit();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("包みが無ければ、内側の schema で止まる", async () => {
    const schema = object({ x: dyn(z.string()) });
    const { submit, onSubmit, messagesAt } = renderForm(schema, { x: "" });
    await submit();
    expect(messagesAt("x")).toContain("内側の必須");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("外側の .refine() は、内側の schema に合っている値にだけかかる（内側のエラーを先に出す）", async () => {
    const schema = object({
      x: dyn(z.string()).refine((v) => v !== "", "外のrefine"),
    });
    const { submit, messagesAt } = renderForm(schema, { x: "" });
    await submit();
    expect(messagesAt("x")).toContain("内側の必須");
  });

  // 同じ path の受け渡しでは直らない（path の違う object の refine）。今の動きを記録しておく
  it.fails(
    "参考：zf.dynamic()（z.never が土台）の兄弟がいても、object の .refine() が効く",
    async () => {
      const x = zf.dynamic().register(
        zf.dynamic.registry,
        defineDynamicMeta({
          resolve: () => ({ key: "fixed", schema: z.string() }),
        }),
      );
      const schema = object({ a: z.string(), x }).refine((o) => o.a !== "bad", {
        path: ["a"],
        message: "object のrefine",
      });
      const { submit, onSubmit, messagesAt } = renderForm(schema, {
        a: "bad",
        x: "ok",
      });
      await submit();
      expect(messagesAt("a")).toContain("object のrefine");
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("optional な tuple の要素は、optional にならない（外の包みは path が変わると切れる）", async () => {
    const schema = object({
      t: z
        .tuple([zf.string().register(zf.string.registry, { label: "要素" })])
        .optional(),
    });
    renderForm(schema, { t: ["a"] });
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.required).toBe(true);
  });
});
