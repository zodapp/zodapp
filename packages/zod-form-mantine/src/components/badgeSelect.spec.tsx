// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import {
  BadgeSelect,
  type OptionDataType,
} from "@zodapp/zod-form-mantine-lite/utils";

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

const data: OptionDataType[] = [
  { value: "todo", label: "未着手", color: "gray" },
  { value: "doing", label: "進行中", color: "blue" },
  { value: "done", label: "完了", color: "green" },
  { value: "broken", label: "（不正な値）", disabled: true },
];

const renderSelect = (initial: string | null) => {
  const onChange = vi.fn();
  const Controlled = () => {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <MantineProvider env="test">
        <BadgeSelect
          label="ステータス"
          value={value}
          data={data}
          placeholder="選択"
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      </MantineProvider>
    );
  };
  render(<Controlled />);
  const input = screen.getByRole("textbox", {
    name: "ステータス",
  }) as HTMLInputElement;
  return { input, onChange };
};

const badge = () => screen.queryByTestId("badge-select-value");

describe("BadgeSelect", () => {
  beforeEach(() => setupDomMocks());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("閉じている間は選択済みの値をバッジで出し、入力欄の文字は空", () => {
    const { input } = renderSelect("doing");
    expect(badge()?.textContent).toBe("進行中");
    expect(input.value).toBe("");
  });

  it("値がないときはバッジを出さず placeholder を出す", () => {
    const { input } = renderSelect(null);
    expect(badge()).toBeNull();
    expect(input.placeholder).toBe("選択");
  });

  it("フォーカスすると選択済みのラベルを placeholder に出し、打ち込んだ文字で絞り込む", async () => {
    const user = userEvent.setup();
    const { input } = renderSelect("doing");
    await user.click(input);
    expect(badge()).toBeNull();
    expect(input.placeholder).toBe("進行中");

    await user.type(input, "完");
    // 既存のラベルに足されない
    expect(input.value).toBe("完");
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.map((o) => o.textContent)).toEqual(["完了"]);
    });
  });

  it("選択肢を選ぶと onChange が値で呼ばれ、閉じるとバッジが出る", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderSelect("doing");
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "完了" }));
    expect(onChange).toHaveBeenCalledWith("done");
    await user.tab();
    expect(badge()?.textContent).toBe("完了");
    expect(input.value).toBe("");
  });

  it("クリアボタンで null になる", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect("doing");
    await user.click(screen.getByRole("button", { name: "クリア" }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(badge()).toBeNull();
  });

  it("一致する選択肢がなければ「見つかりません」を出す", async () => {
    const user = userEvent.setup();
    const { input } = renderSelect(null);
    await user.type(input, "zzz");
    expect(await screen.findByText("見つかりません")).toBeTruthy();
  });

  it("disabled の選択肢は選べない", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderSelect("doing");
    await user.click(input);
    const option = await screen.findByRole("option", { name: "（不正な値）" });
    await user.click(option);
    expect(onChange).not.toHaveBeenCalled();
  });
});
