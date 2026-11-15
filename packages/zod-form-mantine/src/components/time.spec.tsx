// @vitest-environment jsdom
import React, { Suspense } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { TimeComponent as TableTimeComponent } from "@zodapp/zod-form-mantine-lite/tableComponents";
import { component as ObjectComponent } from "./object";
import { component as TimeComponent } from "./time";

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
  time: () => ({ component: TimeComponent }),
};

const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const result: { values?: () => Record<string, unknown> } = {};
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
    });
    result.values = () => form.state.values as Record<string, unknown>;
    return (
      <MantineProvider>
        <ZodFormContextProvider componentLibrary={componentLibrary}>
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
  return result as { values: () => Record<string, unknown> };
};

describe("zf.time", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hoursOfDay の数値は、時の選択肢で HH:00 として表示する", async () => {
    const schema = z.object({
      start: z.number().register(zf.time.registry, {
        label: "開始",
        encoding: "hoursOfDay",
      }),
    });
    renderForm(schema, { start: 9 });
    expect(
      (await screen.findAllByDisplayValue("09:00")).length,
    ).toBeGreaterThan(0);
  });

  it("開いただけでは値に触らず、変えたときだけ precision の形式で書く", async () => {
    const schemaMs = z.object({
      start: z.iso.time({ precision: 2 }).register(zf.time.registry, {
        label: "開始",
      }),
    });
    const form = renderForm(schemaMs, { start: "09:30" });
    const input = (await screen.findByPlaceholderText(
      "HH:mm:ss.SSS",
    )) as HTMLInputElement;
    expect(input.value).toBe("09:30:00.000");
    expect(form.values().start).toBe("09:30");

    fireEvent.change(input, { target: { value: "09:30:15.25" } });
    expect(form.values().start).toBe("09:30:15.25");
  });

  it("表では数値も HH:mm の形で表示する", () => {
    const schema = z.number().register(zf.time.registry, {
      encoding: "minutesOfDay",
    });
    render(
      <MantineProvider>
        <TableTimeComponent
          schema={schema as never}
          fieldPath="start"
          defaultValue={570}
        />
      </MantineProvider>,
    );
    expect(screen.getByText("09:30")).toBeTruthy();
  });
});
