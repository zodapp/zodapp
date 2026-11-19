// @vitest-environment jsdom
/**
 * AutoForm の onSubmit には、parse した値（z.output）を渡す（#1）
 */
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { AutoForm } from "./AutoForm";

const setupDomMocks = () => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
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

const renderAutoForm = <T extends z.ZodTypeAny>(
  schema: T,
  defaultValues?: z.input<T>,
) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <MantineProvider>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </MantineProvider>,
  );
  const submit = async () =>
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  const cancel = async () =>
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  return { onSubmit, onCancel, submit, cancel };
};

/** 同期で schema が決まる dynamic */
const dynamicOf = (schema: z.ZodTypeAny) =>
  zf
    .dynamic()
    .register(
      zf.dynamic.registry,
      defineDynamicMeta({ resolve: () => ({ key: "fixed", schema }) }),
    );

describe("AutoForm の onSubmit は parse した値を受け取る", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("trim・toLowerCase・default・coerce・transform の結果が届く", async () => {
    const schema = z.object({
      name: z.string().trim().toLowerCase(),
      tag: z.string().default("d"),
      count: z.coerce.number(),
      upper: z.string().transform((value) => value.toUpperCase()),
    });
    const { onSubmit, submit } = renderAutoForm(schema, {
      name: "  ABC  ",
      count: "3",
      upper: "x",
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "abc",
        tag: "d",
        count: 3,
        upper: "X",
      }),
    );
  });

  it("onCancel には、フォームの値（input）を渡す", async () => {
    const schema = z.object({ name: z.string().trim() });
    const { onCancel, cancel } = renderAutoForm(schema, { name: "  a  " });
    await cancel();
    await waitFor(() =>
      expect(onCancel).toHaveBeenCalledWith({ name: "  a  " }),
    );
  });

  it("dynamic の output が届き、外側の transform・refine は dynamic の output を受け取る", async () => {
    const seen = vi.fn();
    const schema = z
      .object({
        amount: dynamicOf(z.string().transform(Number)),
        list: z.array(z.object({ v: dynamicOf(z.string().trim()) })),
      })
      .refine((value) => {
        seen(value.amount);
        return true;
      })
      .transform((value) => ({
        ...value,
        doubled: (value.amount as number) * 2,
      }));
    const { onSubmit, submit } = renderAutoForm(schema, {
      amount: "21",
      list: [{ v: " a " }],
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        amount: 21,
        list: [{ v: "a" }],
        doubled: 42,
      }),
    );
    expect(seen).toHaveBeenLastCalledWith(21);
  });

  it("dynamic の中の dynamic は、内側を先に差し込む", async () => {
    const inner = dynamicOf(z.string().transform((value) => `${value}!`));
    const schema = z.object({
      outer: dynamicOf(z.object({ inner })),
    });
    const { onSubmit, submit } = renderAutoForm(schema, {
      outer: { inner: "x" },
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ outer: { inner: "x!" } }),
    );
  });
});
