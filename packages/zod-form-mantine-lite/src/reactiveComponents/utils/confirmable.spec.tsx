/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ReactiveFormContextProvider,
  type ReactiveFormContextValue,
} from "../context";
import { useConfirmableState } from "./confirmable";

type ConfirmableState = ReturnType<typeof useConfirmableState<string>>;
type TestRoot = {
  render: (children: ReactNode) => void;
  unmount: () => void;
};

let container: HTMLDivElement | undefined;
let root: TestRoot | undefined;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  container = undefined;
  root = undefined;
});

const renderConfirmableState = async ({
  onBlur,
  onConfirm,
}: ReactiveFormContextValue) => {
  let state: ConfirmableState | undefined;

  const CaptureState = () => {
    state = useConfirmableState("before", "name");
    return null;
  };

  container = document.createElement("div");
  document.body.appendChild(container);
  const reactDomClientModule = "react-dom/client";
  const { createRoot } = (await import(reactDomClientModule)) as {
    createRoot: (container: Element | DocumentFragment) => TestRoot;
  };
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <ReactiveFormContextProvider onBlur={onBlur} onConfirm={onConfirm}>
        <CaptureState />
      </ReactiveFormContextProvider>,
    );
  });

  if (!state) {
    throw new Error("confirmable state was not captured");
  }

  return () => {
    if (!state) {
      throw new Error("confirmable state was not captured");
    }
    return state;
  };
};

describe("useConfirmableState", () => {
  it("commits pending value when blur guard returns true", async () => {
    const onBlur = vi.fn(() => true);
    const onConfirm = vi.fn();
    const getState = await renderConfirmableState({ onBlur, onConfirm });

    act(() => {
      getState().onChange("after");
    });
    await act(async () => {
      await getState().onBlur();
    });

    expect(onBlur).toHaveBeenCalledWith({
      fieldPath: "name",
      value: "after",
      previousValue: "before",
    });
    expect(onConfirm).toHaveBeenCalledWith({
      fieldPath: "name",
      value: "after",
      previousValue: "before",
    });
    expect(getState().hasPendingChange).toBe(false);
  });

  it("reverts pending value when blur guard returns false", async () => {
    const onBlur = vi.fn(() => false);
    const onConfirm = vi.fn();
    const getState = await renderConfirmableState({ onBlur, onConfirm });

    act(() => {
      getState().onChange("after");
    });
    await act(async () => {
      await getState().onBlur();
    });

    expect(onBlur).toHaveBeenCalledWith({
      fieldPath: "name",
      value: "after",
      previousValue: "before",
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(getState().value).toBe("before");
    expect(getState().hasPendingChange).toBe(false);
  });

  it("keeps pending value when blur guard returns undefined", async () => {
    const onBlur = vi.fn(() => undefined);
    const onConfirm = vi.fn();
    const getState = await renderConfirmableState({ onBlur, onConfirm });

    act(() => {
      getState().onChange("after");
    });
    await act(async () => {
      await getState().onBlur();
    });

    expect(onBlur).toHaveBeenCalledWith({
      fieldPath: "name",
      value: "after",
      previousValue: "before",
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(getState().value).toBe("after");
    expect(getState().hasPendingChange).toBe(true);
  });

  it("keeps pending value when blur guard is not configured", async () => {
    const onConfirm = vi.fn();
    const getState = await renderConfirmableState({ onConfirm });

    act(() => {
      getState().onChange("after");
    });
    await act(async () => {
      await getState().onBlur();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(getState().value).toBe("after");
    expect(getState().hasPendingChange).toBe(true);
  });

  it("commits pending value on explicit confirm without blur guard", async () => {
    const onBlur = vi.fn();
    const onConfirm = vi.fn();
    const getState = await renderConfirmableState({ onBlur, onConfirm });

    act(() => {
      getState().onChange("after");
    });
    await act(async () => {
      await getState().onConfirm();
    });

    expect(onBlur).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledWith({
      fieldPath: "name",
      value: "after",
      previousValue: "before",
    });
    expect(getState().hasPendingChange).toBe(false);
  });
});
