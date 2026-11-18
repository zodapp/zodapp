// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  DateComponent,
  ReactiveFormContextProvider,
} from "@zodapp/zod-form-mantine-lite/reactiveComponents";

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

const renderDate = (schema: z.ZodTypeAny, defaultValue: unknown) => {
  const onConfirm = vi.fn();
  render(
    <MantineProvider>
      <ReactiveFormContextProvider onBlur={() => true} onConfirm={onConfirm}>
        <DateComponent
          fieldPath="day"
          schema={schema as never}
          defaultValue={defaultValue as never}
        />
      </ReactiveFormContextProvider>
    </MantineProvider>,
  );
  return {
    onConfirm,
    input: screen.getByLabelText(/^日付/) as HTMLInputElement,
  };
};

const typeAndLeave = async (input: HTMLInputElement, text: string) => {
  await act(async () => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
  });
  await act(async () => {
    fireEvent.blur(input);
  });
};

describe("reactive 版の日付の欄", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("z.date() の欄は、onConfirm に Date を渡す（元の値も Date のまま）", async () => {
    const original = new Date(2026, 0, 2);
    const schema = zf
      .date()
      .register(zf.date.registry, { label: "日付", unit: "day" });
    const { onConfirm, input } = renderDate(schema, original);

    await typeAndLeave(input, "2026-11-17");

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const event = onConfirm.mock.calls[0]![0];
    expect(event.value).toBeInstanceOf(Date);
    expect((event.value as Date).getFullYear()).toBe(2026);
    expect((event.value as Date).getMonth()).toBe(10);
    expect((event.value as Date).getDate()).toBe(17);
    expect(event.previousValue).toBe(original);
  });
});
