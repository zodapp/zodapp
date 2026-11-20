// @vitest-environment jsdom
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja as jaMessages } from "../messages";
import React, { Suspense } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
        <I18nMessagesProvider locale="ja" messages={jaMessages}>
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
    // precision 2 の欄は、小数 2 桁で見せる
    const input = (await screen.findByPlaceholderText(
      "HH:mm:ss.SS",
    )) as HTMLInputElement;
    expect(input.value).toBe("09:30:00.00");
    expect(form.values().start).toBe("09:30");

    fireEvent.change(input, { target: { value: "09:30:15.25" } });
    // 打っている途中では書かず、blur で確定する
    expect(form.values().start).toBe("09:30");
    fireEvent.blur(input);
    expect(form.values().start).toBe("09:30:15.25");
    expect(input.value).toBe("09:30:15.25");
  });

  it.each([
    [1, "09:30:15.2", "HH:mm:ss.S"],
    [2, "09:30:15.25", "HH:mm:ss.SS"],
  ])(
    "precision %i の欄は、フォーカスして外すだけでは値もエラーも変わらない",
    async (precision, stored, format) => {
      const user = userEvent.setup();
      const schema = z.object({
        start: z.iso.time({ precision }).register(zf.time.registry, {
          label: "開始",
        }),
      });
      const form = renderForm(schema, { start: stored });
      const input = (await screen.findByPlaceholderText(
        format,
      )) as HTMLInputElement;
      expect(input.value).toBe(stored);
      await user.click(input);
      await user.tab();
      expect(form.values().start).toBe(stored);
      expect(input.value).toBe(stored);
      expect(
        screen.queryByText(`${format} の形で、正しい時刻を入力してください`),
      ).toBeNull();
    },
  );

  describe("ミリ秒の欄を 1 文字ずつ打つ", () => {
    const schemaMs = z.object({
      start: z.iso.time({ precision: 3 }).register(zf.time.registry, {
        label: "開始",
      }),
    });
    const findInput = async () =>
      (await screen.findByPlaceholderText("HH:mm:ss.SSS")) as HTMLInputElement;

    it("空の欄に打って blur すると、打った時刻を書く", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, {});
      const input = await findInput();
      await user.click(input);
      await user.keyboard("10:45:30.123");
      // 打っている途中で整えた値が戻って、打った文字が崩れることはない
      expect(input.value).toBe("10:45:30.123");
      expect(form.values().start).toBeUndefined();
      await user.tab();
      expect(form.values().start).toBe("10:45:30.123");
      expect(input.value).toBe("10:45:30.123");
    });

    it("途中で Backspace で消しても戻らず、blur で残った文字を書く", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, { start: "09:30:15.250" });
      const input = await findInput();
      await user.click(input);
      await user.keyboard("{End}{Backspace}{Backspace}");
      expect(input.value).toBe("09:30:15.2");
      await user.keyboard("{Backspace}{Backspace}");
      expect(input.value).toBe("09:30:15");
      await user.tab();
      expect(form.values().start).toBe("09:30:15.000");
      expect(input.value).toBe("09:30:15.000");
    });

    it("読めない文字は、前の値を残さず、そのまま書いて形式のエラーを出す", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, { start: "09:30:15.250" });
      const input = await findInput();
      await user.clear(input);
      await user.keyboard("9:30");
      await user.tab();
      expect(input.value).toBe("9:30");
      // 画面の文字と値が食い違わない（schema の検証で通らないので保存できない）
      expect(form.values().start).toBe("9:30");
      expect(schemaMs.safeParse(form.values()).success).toBe(false);
      expect(
        await screen.findByText(
          "HH:mm:ss.SSS の形で、正しい時刻を入力してください",
        ),
      ).toBeTruthy();

      // 直すと、エラーが消えて値に書く
      await user.clear(input);
      await user.keyboard("09:30:00.5");
      await user.tab();
      expect(form.values().start).toBe("09:30:00.500");
      expect(
        screen.queryByText("HH:mm:ss.SSS の形で、正しい時刻を入力してください"),
      ).toBeNull();
    });

    it("範囲外の時刻や、precision より多い小数の桁は、必須のエラーではなく形式のエラーにする", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, { start: "09:30:15.250" });
      const input = await findInput();
      for (const text of ["10:00:00.1234", "12:60:00", "24:00:00.000"]) {
        await user.clear(input);
        await user.keyboard(text);
        await user.tab();
        expect(input.value).toBe(text);
        expect(form.values().start).toBe(text);
        expect(
          await screen.findByText(
            "HH:mm:ss.SSS の形で、正しい時刻を入力してください",
          ),
        ).toBeTruthy();
        expect(screen.queryByText("必ず入力してください")).toBeNull();
      }
    });

    it("Enter で確定する", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, {});
      const input = await findInput();
      await user.click(input);
      await user.keyboard("08:05:09.7{Enter}");
      expect(form.values().start).toBe("08:05:09.700");
      expect(input.value).toBe("08:05:09.700");
    });

    it("HH:mm だけなら 0 秒として書く", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, {});
      const input = await findInput();
      await user.click(input);
      await user.keyboard("09:30");
      await user.tab();
      expect(form.values().start).toBe("09:30:00.000");
      expect(input.value).toBe("09:30:00.000");
    });

    it("空にして確定すると、値を消す", async () => {
      const user = userEvent.setup();
      const form = renderForm(schemaMs, { start: "09:30:15.250" });
      const input = await findInput();
      await user.clear(input);
      await user.tab();
      expect(form.values().start).toBeUndefined();
      expect(input.value).toBe("");
    });

    it("millisecondsOfDay の数値でも、打ち終えてから書く", async () => {
      const user = userEvent.setup();
      const schema = z.object({
        start: z.number().register(zf.time.registry, {
          label: "開始",
          encoding: "millisecondsOfDay",
        }),
      });
      const form = renderForm(schema, {});
      const input = await findInput();
      await user.click(input);
      await user.keyboard("00:00:01.5");
      expect(form.values().start).toBeUndefined();
      await user.tab();
      expect(form.values().start).toBe(1500);
      expect(input.value).toBe("00:00:01.500");
    });
  });

  it("時と分の欄で、分だけを消しても時は消えない", async () => {
    const user = userEvent.setup();
    const schema = z.object({
      start: z.iso.time({ precision: -1 }).register(zf.time.registry, {
        label: "開始",
      }),
    });
    const form = renderForm(schema, { start: "09:30" });
    const [hours, minutes] = (await screen.findAllByRole(
      "spinbutton",
    )) as HTMLInputElement[];
    await user.click(minutes!);
    await user.keyboard("{Backspace}{Backspace}");
    expect(hours!.value).toBe("09");
    expect(form.values().start).toBeUndefined();
    await user.click(minutes!);
    await user.keyboard("45");
    expect(hours!.value).toBe("09");
    expect(form.values().start).toBe("09:45");
  });

  it("表では数値も HH:mm の形で表示する", () => {
    const schema = z.number().register(zf.time.registry, {
      encoding: "minutesOfDay",
    });
    render(
      <MantineProvider>
        <I18nMessagesProvider locale="ja" messages={jaMessages}>
          <TableTimeComponent
            schema={schema as never}
            fieldPath="start"
            value={570}
          />
        </I18nMessagesProvider>
      </MantineProvider>,
    );
    expect(screen.getByText("09:30")).toBeTruthy();
  });
});
