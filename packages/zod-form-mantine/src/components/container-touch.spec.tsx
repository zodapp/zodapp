// @vitest-environment jsdom
import React, { Suspense } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
  ValidatePrecedingFieldsProvider,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as LiteralComponent } from "./literal";
import { component as UnionComponent } from "./union";
import { component as IntersectionComponent } from "./intersection";
import { component as ArrayComponent } from "./array";
import { component as RecordComponent } from "./record";

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
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
};

const componentLibrary = {
  ...baseComponents,
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  literal: () => ({ component: LiteralComponent }),
  union: () => ({ component: UnionComponent }),
  intersection: () => ({ component: IntersectionComponent }),
  array: () => ({ component: ArrayComponent }),
  record: () => ({ component: RecordComponent }),
};

/** AutoForm と同じく、前の欄を検証するしくみ（ValidatePrecedingFieldsProvider）の中に描く */
const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const formRef: { current: AnyFormApi | undefined } = { current: undefined };
  const onSubmit = vi.fn();
  const validator = schema as unknown as z.ZodType<
    Record<string, unknown>,
    Record<string, unknown>
  >;
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
        <ZodFormContextProvider componentLibrary={componentLibrary}>
          <FormProvider form={form}>
            <ValidatePrecedingFieldsProvider>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
                <button onClick={() => void form.handleSubmit()}>送信</button>
              </Suspense>
            </ValidatePrecedingFieldsProvider>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
  return { formRef, onSubmit };
};

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const focus = (element: HTMLElement) => act(() => element.focus());
const blur = (element: HTMLElement) => act(() => element.blur());
const change = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "送信" }));
/** 少し待って、まだ出ていないことを確かめる */
const expectAbsent = async (message: string) => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryAllByText(message)).toHaveLength(0);
};

const MISMATCH = "開始と終了を変えてください";

/** pair（開始・終了。path の無い refine）と、その後ろの memo */
const pairSchema = () =>
  z.object({
    pair: zf
      .object({ from: text("開始"), to: text("終了") })
      .refine((value) => value.from !== value.to, { message: MISMATCH })
      .register(zf.object.registry, { label: "期間" }),
    memo: text("メモ"),
  });

describe("入れ物の欄を触った・変えたにする（ContainerMarker）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("入れ物の最後の欄を離すと、入れ物のエラーが出る", async () => {
    renderForm(pairSchema(), { pair: { from: "a", to: "a" }, memo: "" });
    const to = await screen.findByLabelText(/^終了/);
    focus(to);
    blur(to);
    await waitFor(() => expect(screen.getAllByText(MISMATCH)).toHaveLength(1));
  });

  it("最後でない欄を離しただけでは、入れ物のエラーは出ない", async () => {
    renderForm(pairSchema(), { pair: { from: "a", to: "a" }, memo: "" });
    const from = await screen.findByLabelText(/^開始/);
    focus(from);
    blur(from);
    await expectAbsent(MISMATCH);
    // 入れ物の中の次の欄に移っても出ない
    focus(from);
    focus(screen.getByLabelText(/^終了/));
    await expectAbsent(MISMATCH);
  });

  it("中に欄の無い入れ物（空の配列）は、直前の欄を離しても触ったことにならない", async () => {
    const schema = z.object({
      name: text("名前"),
      tags: z
        .array(zf.string())
        .min(1, "タグを 1 つ以上入れてください")
        .register(zf.array.registry, { label: "タグ" }),
    });
    renderForm(schema, { name: "", tags: [] });
    const name = await screen.findByLabelText(/^名前/);
    focus(name);
    blur(name);
    await expectAbsent("タグを 1 つ以上入れてください");
  });

  it("入れ物より後ろの欄にフォーカスすると、入れ物のエラーが出る", async () => {
    renderForm(pairSchema(), { pair: { from: "a", to: "a" }, memo: "" });
    focus(await screen.findByLabelText(/^メモ/));
    await waitFor(() => expect(screen.getAllByText(MISMATCH)).toHaveLength(1));
  });

  it("入れ子：内側の最後の欄が外側の最後の欄でもあれば、離すと両方のエラーが出る", async () => {
    const schema = z.object({
      outer: zf
        .object({
          name: text("名前"),
          inner: zf
            .object({ a: text("A"), b: text("B") })
            .refine((value) => value.a !== value.b, { message: "内側のエラー" })
            .register(zf.object.registry, { label: "内側" }),
        })
        .refine((value) => value.name !== "", { message: "外側のエラー" })
        .register(zf.object.registry, { label: "外側" }),
    });
    renderForm(schema, { outer: { name: "", inner: { a: "x", b: "x" } } });
    const b = await screen.findByLabelText(/^B/);
    focus(b);
    blur(b);
    await waitFor(() => {
      expect(screen.getAllByText("内側のエラー")).toHaveLength(1);
      expect(screen.getAllByText("外側のエラー")).toHaveLength(1);
    });
  });

  it("送信でエラーを出したあと、子の欄を直すとエラーが消え、送り直せる", async () => {
    const { formRef, onSubmit } = renderForm(pairSchema(), {
      pair: { from: "a", to: "a" },
      memo: "",
    });
    const from = await screen.findByLabelText(/^開始/);
    submit();
    await waitFor(() => expect(screen.getAllByText(MISMATCH)).toHaveLength(1));
    // 最後でない欄（開始）を直し、そのまま送信する
    change(from, "b");
    await waitFor(() =>
      expect(screen.queryAllByText(MISMATCH)).toHaveLength(0),
    );
    expect(formRef.current!.getFieldMeta("pair")?.errorMap.onSubmit).toBe(
      undefined,
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      pair: { from: "b", to: "a" },
      memo: "",
    });
  });

  it("直しても正しくない値のままなら、エラーは出たまま", async () => {
    const { onSubmit } = renderForm(pairSchema(), {
      pair: { from: "a", to: "a" },
      memo: "",
    });
    const from = await screen.findByLabelText(/^開始/);
    submit();
    await waitFor(() => expect(screen.getAllByText(MISMATCH)).toHaveLength(1));
    change(from, "b");
    change(from, "a");
    await waitFor(() => expect(screen.getAllByText(MISMATCH)).toHaveLength(1));
    submit();
    await expectAbsent("（送信されない）");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("intersection：左側の最後の欄を離しても出ず、全体の最後の欄を離すと出る", async () => {
    const schema = z.object({
      period: zf
        .intersection(
          zf.object({ from: text("開始") }),
          zf.object({ to: text("終了") }),
        )
        .refine((value) => value.from !== value.to, { message: MISMATCH })
        .register(zf.intersection.registry, { label: "期間" }),
    });
    const { onSubmit } = renderForm(schema, { period: { from: "a", to: "a" } });
    const from = await screen.findByLabelText(/^開始/);
    focus(from);
    blur(from);
    await expectAbsent(MISMATCH);
    const to = screen.getByLabelText(/^終了/);
    focus(to);
    blur(to);
    await waitFor(() => expect(screen.getAllByText(MISMATCH)).toHaveLength(1));
    // 送信でエラーにしてから直すと、送り直せる
    submit();
    change(from, "b");
    await waitFor(() =>
      expect(screen.queryAllByText(MISMATCH)).toHaveLength(0),
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("array：最後の要素を離すとエラーが出て、直すと送り直せる", async () => {
    const schema = z.object({
      tags: z
        .array(zf.string())
        .refine((value) => new Set(value).size === value.length, {
          message: "同じ値があります",
        })
        .register(zf.array.registry, { label: "タグ" }),
    });
    const { onSubmit } = renderForm(schema, { tags: ["x", "x"] });
    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2));
    const [first, last] = screen.getAllByRole("textbox") as HTMLElement[];
    focus(first!);
    blur(first!);
    await expectAbsent("同じ値があります");
    focus(last!);
    blur(last!);
    await waitFor(() =>
      expect(screen.getAllByText("同じ値があります")).toHaveLength(1),
    );
    submit();
    change(first!, "y");
    await waitFor(() =>
      expect(screen.queryAllByText("同じ値があります")).toHaveLength(0),
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("record：最後の値を離すとエラーが出て、直すと送り直せる", async () => {
    const schema = z.object({
      entries: z
        .record(z.string(), z.string())
        .refine((value) => new Set(Object.values(value)).size > 1, {
          message: "値をすべて同じにはできません",
        })
        .register(zf.record.registry, { label: "項目" }),
    });
    const { onSubmit } = renderForm(schema, { entries: { a: "x", b: "x" } });
    const a = await screen.findByLabelText(/^a/);
    const b = screen.getByLabelText(/^b/);
    focus(a);
    blur(a);
    await expectAbsent("値をすべて同じにはできません");
    focus(b);
    blur(b);
    await waitFor(() =>
      expect(screen.getAllByText("値をすべて同じにはできません")).toHaveLength(
        1,
      ),
    );
    submit();
    change(a, "y");
    await waitFor(() =>
      expect(
        screen.queryAllByText("値をすべて同じにはできません"),
      ).toHaveLength(0),
    );
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
