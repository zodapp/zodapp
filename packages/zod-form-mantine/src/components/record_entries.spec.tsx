// @vitest-environment jsdom
import React from "react";
import {
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
  FormProvider,
  Switch,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { component as RecordComponent } from "./record";
import { component as RecordEntriesComponent } from "./record_entries";
import { component as StringComponent } from "./string";

const slotKeySchema = z
  .string()
  .min(1, "キーを入力してください")
  .refine((key) => !/[.[\]"]/.test(key), "使用できない文字が含まれています");

const createRecordSchema = (uiType?: string) =>
  z
    .record(slotKeySchema, z.string())
    .register(zf.record.registry, { label: "初期スロット", uiType });

type TestFormProps = {
  defaultValues: { slots: Record<string, string> };
  readOnly?: boolean;
  uiType?: string;
  onCapture?: (value: Record<string, string>) => void;
};

function TestForm({
  defaultValues,
  readOnly = false,
  uiType = "entries",
  onCapture,
}: TestFormProps) {
  const recordSchema = createRecordSchema(uiType);
  const form = useZodForm({ defaultValues });

  return (
    <MantineProvider>
      <ZodFormContextProvider
        componentLibrary={{
          record: () => ({ component: RecordComponent }),
          record_entries: () => ({ component: RecordEntriesComponent }),
          string: () => ({ component: StringComponent }),
        }}
      >
        <FormProvider form={form}>
          <Switch
            fieldPath="slots"
            schema={recordSchema}
            required
            readOnly={readOnly}
          />
          {onCapture && (
            <button
              type="button"
              onClick={() => onCapture(form.state.values.slots)}
            >
              Capture
            </button>
          )}
        </FormProvider>
      </ZodFormContextProvider>
    </MantineProvider>
  );
}

describe("RecordEntriesComponent", () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Switchがentries指定からkey/value UIを選択する", async () => {
    render(<TestForm defaultValues={{ slots: { 顧客ID: "00123" } }} />);

    expect(await screen.findByDisplayValue("顧客ID")).toBeTruthy();
    expect(await screen.findByDisplayValue("00123")).toBeTruthy();
    expect(screen.getByRole("button", { name: "末尾に追加" })).toBeTruthy();
  });

  it("行を追加してキーと値を変更できる", async () => {
    const onCapture = vi.fn();
    render(<TestForm defaultValues={{ slots: {} }} onCapture={onCapture} />);

    fireEvent.click(screen.getByRole("button", { name: "末尾に追加" }));
    const keyInput = await screen.findByLabelText("キー");
    expect((keyInput as HTMLInputElement).value).toBe("");
    expect(
      screen.getByPlaceholderText("先にキーを入力してください"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    expect(onCapture).toHaveBeenLastCalledWith({});

    fireEvent.change(keyInput, {
      target: { value: "契約番号" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /値/ }), {
      target: { value: "C-999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith({ 契約番号: "C-999" });
    });
  });

  it("行を削除できる", async () => {
    const onCapture = vi.fn();
    render(
      <TestForm
        defaultValues={{ slots: { 顧客ID: "00123" } }}
        onCapture={onCapture}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "顧客IDを削除" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith({});
    });
  });

  it("不正なキーと重複キーをrecordへ反映しない", async () => {
    const onCapture = vi.fn();
    const { rerender } = render(
      <TestForm
        defaultValues={{ slots: { 顧客ID: "00123", 契約番号: "C-999" } }}
        onCapture={onCapture}
      />,
    );

    fireEvent.change(await screen.findByDisplayValue("顧客ID"), {
      target: { value: "顧客.ID" },
    });
    expect(
      await screen.findByText("使用できない文字が含まれています"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    expect(onCapture).toHaveBeenLastCalledWith({
      顧客ID: "00123",
      契約番号: "C-999",
    });

    rerender(
      <TestForm
        defaultValues={{ slots: { 顧客ID: "00123", 契約番号: "C-999" } }}
        onCapture={onCapture}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("顧客.ID"), {
      target: { value: "契約番号" },
    });
    expect(await screen.findByText("同じキーが既に存在します")).toBeTruthy();
  });

  it("readOnlyでは編集操作を表示しない", async () => {
    render(
      <TestForm defaultValues={{ slots: { 顧客ID: "00123" } }} readOnly />,
    );

    expect(await screen.findByText("00123")).toBeTruthy();
    expect(
      screen.getByDisplayValue("顧客ID").getAttribute("readonly"),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "末尾に追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "顧客IDを削除" })).toBeNull();
  });

  it("Switchがentries以外では従来のrecord表示へフォールバックする", async () => {
    render(
      <TestForm
        defaultValues={{ slots: { 顧客ID: "00123" } }}
        uiType="plain"
      />,
    );

    expect(
      (
        (await screen.findByRole("textbox", {
          name: /顧客ID/,
        })) as HTMLInputElement
      ).value,
    ).toBe("00123");
    expect(screen.queryByLabelText("キー")).toBeNull();
    expect(screen.queryByRole("button", { name: "末尾に追加" })).toBeNull();
  });
});
