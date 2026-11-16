// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
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
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import type { ExternalKeyResolvers } from "@zodapp/zod-form/externalKey/types";
import {
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import {
  useExternalKeyOptions,
  type UseExternalKeyOptionsResult,
} from "@zodapp/zod-form-react/utils/externalKey";
import { ExternalKeyComponent as ReactiveExternalKeyComponent } from "@zodapp/zod-form-mantine-lite/reactiveComponents";
import { ExternalKeyComponent as TableExternalKeyComponent } from "@zodapp/zod-form-mantine-lite/tableComponents";
import { component as MultipleExternalKeyComponent } from "./array_multipleExternalKey";
import { component as ArrayOfEnumComponent } from "./array_multipleEnum";

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

type Option = { label: string; value: string };

/** 選択肢と失敗をテストから流せる resolver */
const makeResolver = () => {
  const callbacks = new Set<(options: Option[]) => void>();
  const errorCallbacks = new Set<(error: unknown) => void>();
  const subscribeCount = vi.fn();
  const resolvers: ExternalKeyResolvers = [
    {
      type: "list",
      resolver: () => ({
        subscribe: (callback, onError) => {
          subscribeCount();
          callbacks.add(callback);
          if (onError) errorCallbacks.add(onError);
          return () => {
            callbacks.delete(callback);
            if (onError) errorCallbacks.delete(onError);
          };
        },
      }),
    },
  ];
  const publish = async (options: Option[]) => {
    await act(async () => {
      callbacks.forEach((callback) => callback(options));
    });
  };
  const fail = async (error: unknown) => {
    await act(async () => {
      errorCallbacks.forEach((onError) => onError(error));
    });
  };
  return { resolvers, publish, fail, subscribeCount };
};

const member = zf.string().register(zf.externalKey.registry, {
  label: "担当者",
  externalKeyConfig: { type: "list" },
});

// 複数選択の externalKey は、選択肢が届いたら複数選択の enum の部品で描く
const componentLibrary = {
  array_multipleEnum: () => ({ component: ArrayOfEnumComponent }),
};

const Providers = ({
  resolvers,
  children,
}: {
  resolvers: ExternalKeyResolvers;
  children: React.ReactNode;
}) => (
  <MantineProvider>
    <ZodFormContextProvider
      componentLibrary={componentLibrary as any}
      externalKeyResolvers={resolvers}
    >
      {children}
    </ZodFormContextProvider>
  </MantineProvider>
);

describe("useExternalKeyOptions の失敗と再試行", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderHookResult = (resolvers: ExternalKeyResolvers) => {
    const results: UseExternalKeyOptionsResult[] = [];
    const Probe = () => {
      results.push(useExternalKeyOptions(member));
      return null;
    };
    render(
      <Providers resolvers={resolvers}>
        <Probe />
      </Providers>,
    );
    return () => results[results.length - 1]!;
  };

  it("resolver が onError を呼ぶと、error と retry を返す", async () => {
    const r = makeResolver();
    const latest = renderHookResult(r.resolvers);
    expect(latest().isLoading).toBe(true);
    const error = new Error("失敗");
    await r.fail(error);
    expect(latest()).toMatchObject({ options: null, isLoading: false, error });
    expect(typeof latest().retry).toBe("function");
  });

  it("失敗のあと、同じ購読のまま選択肢が届けば、再試行しなくても戻る", async () => {
    const r = makeResolver();
    const latest = renderHookResult(r.resolvers);
    await r.fail(new Error("失敗"));
    await r.publish([{ label: "A", value: "a" }]);
    expect(latest()).toMatchObject({
      options: [{ label: "A", value: "a" }],
      isLoading: false,
    });
    expect(latest().retry).toBeUndefined();
    expect(r.subscribeCount).toHaveBeenCalledTimes(1);
  });

  it("retry を呼ぶと、購読をやめて最初からやり直す（読み込み中に戻る）", async () => {
    const r = makeResolver();
    const latest = renderHookResult(r.resolvers);
    await r.fail(new Error("失敗"));
    await act(async () => {
      latest().retry!();
    });
    expect(r.subscribeCount).toHaveBeenCalledTimes(2);
    expect(latest().isLoading).toBe(true);
    await r.publish([{ label: "A", value: "a" }]);
    expect(latest().options).toEqual([{ label: "A", value: "a" }]);
  });
});

describe("useExternalKeyOptions を使う部品の失敗の表示", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /** 失敗させ、「再試行」が出て、押すと購読し直し、届けば戻ることを確かめる */
  const expectErrorAndRetry = async (
    r: ReturnType<typeof makeResolver>,
    errorText: string,
    recovered: () => void,
  ) => {
    await r.fail(new Error("失敗"));
    expect(await screen.findByText(errorText)).toBeTruthy();
    expect(
      document.querySelector('[data-dynamic-status="error"]'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(r.subscribeCount).toHaveBeenCalledTimes(2));
    await r.publish([{ label: "利用者 A", value: "u1" }]);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "再試行" })).toBeNull(),
    );
    recovered();
  };

  it("複数選択の externalKey の欄：失敗すると「再試行」を出す", async () => {
    const r = makeResolver();
    const schema = z.array(member).register(zf.array.registry, {
      label: "担当者たち",
      uiType: "multipleExternalKey",
    });
    const runtime = new FormRuntime();
    const Form = () => {
      const form = useZodForm({ defaultValues: { members: ["u1"] } as any });
      return (
        <FormProvider form={form as any} runtime={runtime}>
          <MultipleExternalKeyComponent
            fieldPath="members"
            schema={schema as any}
          />
        </FormProvider>
      );
    };
    render(
      <Providers resolvers={r.resolvers}>
        <Form />
      </Providers>,
    );
    await expectErrorAndRetry(r, "担当者たちを取得できませんでした", () =>
      expect(screen.getAllByText("利用者 A").length).toBeGreaterThan(0),
    );
  });

  it("zod-form-mantine-lite の externalKey の欄：失敗すると「再試行」を出す", async () => {
    const r = makeResolver();
    render(
      <Providers resolvers={r.resolvers}>
        <ReactiveExternalKeyComponent
          fieldPath="member"
          schema={member}
          defaultValue="u1"
        />
      </Providers>,
    );
    await expectErrorAndRetry(r, "担当者を取得できませんでした", () =>
      expect(screen.getByDisplayValue("利用者 A")).toBeTruthy(),
    );
  });

  it("zod-form-mantine-lite の表の externalKey のセル：失敗すると「再試行」を出す", async () => {
    const r = makeResolver();
    render(
      <Providers resolvers={r.resolvers}>
        <TableExternalKeyComponent
          fieldPath="member"
          schema={member}
          defaultValue="u1"
        />
      </Providers>,
    );
    await expectErrorAndRetry(r, "取得できませんでした", () =>
      expect(screen.getByText("利用者 A")).toBeTruthy(),
    );
  });
});
