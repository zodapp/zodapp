import type { ListState } from "@zodapp/zod-dynamodb-client";
import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  ApiProvider,
  createUseItem,
  createUseList,
  stableKey,
  useApi,
} from "./index";

/** 作った store と、その操作を記録するソース */
const fakeListSource = () => {
  const stores: {
    params: unknown;
    options: unknown;
    closed: boolean;
    set: (patch: Partial<ListState<string>>) => void;
    calls: string[];
  }[] = [];
  const source = {
    live: (params: { q: string }, options?: { pageSize?: number }) => {
      let state: ListState<string> = {
        status: "loading",
        items: [],
        hasMore: false,
        isFetchingMore: false,
      };
      const listeners = new Set<() => void>();
      const record = {
        params,
        options,
        closed: false,
        calls: [] as string[],
        set: (patch: Partial<ListState<string>>) => {
          state = { ...state, ...patch };
          for (const l of listeners) l();
        },
      };
      stores.push(record);
      return {
        getState: () => state,
        subscribe: (l: () => void) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        fetchMore: () => record.calls.push("fetchMore"),
        reload: () => record.calls.push("reload"),
        close: () => {
          record.closed = true;
        },
      };
    },
  };
  return { source, useLive: createUseList(source, { live: true }), stores };
};

const strict = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

describe("createUseList", () => {
  it("store の状態を読み、fetchMore・reload を渡す。外したら閉じる", () => {
    const { useLive, stores } = fakeListSource();
    const { result, unmount } = renderHook(() =>
      useLive({ q: "a" }, { pageSize: 2 }),
    );
    expect(result.current.status).toBe("loading");
    expect(stores).toHaveLength(1);
    expect(stores[0]!.options).toEqual({ pageSize: 2 });
    act(() => stores[0]!.set({ status: "ready", items: ["x"], hasMore: true }));
    expect(result.current).toMatchObject({
      status: "ready",
      items: ["x"],
      hasMore: true,
    });
    result.current.fetchMore();
    result.current.reload();
    expect(stores[0]!.calls).toEqual(["fetchMore", "reload"]);
    unmount();
    expect(stores[0]!.closed).toBe(true);
  });

  it("params が値として変わったときだけ作り直す", () => {
    const { useLive, stores } = fakeListSource();
    const { rerender } = renderHook(({ q }) => useLive({ q }), {
      initialProps: { q: "a" },
    });
    rerender({ q: "a" }); // 別のオブジェクトでも同じ値
    expect(stores).toHaveLength(1);
    rerender({ q: "b" });
    expect(stores).toHaveLength(2);
    expect(stores[0]!.closed).toBe(true);
    expect(stores[1]!.params).toEqual({ q: "b" });
  });

  it("StrictMode でも、最後には開いた store が 1 つだけ残る", () => {
    const { useLive, stores } = fakeListSource();
    const { result, unmount } = renderHook(() => useLive({ q: "a" }), {
      wrapper: strict,
    });
    const open = stores.filter((s) => !s.closed);
    expect(open).toHaveLength(1);
    act(() => open[0]!.set({ status: "ready", items: ["y"] }));
    expect(result.current.items).toEqual(["y"]);
    unmount();
    expect(stores.every((s) => s.closed)).toBe(true);
  });
});

describe("createUseList（1 回きり）", () => {
  it("クエリの関数で、ページを cursor で順に読む", async () => {
    const calls: unknown[] = [];
    const query = async (
      params: { q: string },
      options?: { cursor?: string; limit?: number; fields?: unknown },
    ) => {
      calls.push({ params, ...options });
      return options?.cursor
        ? { items: ["b"] }
        : { items: ["a"], cursor: "c1" };
    };
    const useOnce = createUseList(query);
    const { result } = renderHook(() => useOnce({ q: "x" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toMatchObject({
      status: "ready",
      items: ["a", "b"],
    });
    expect(calls).toHaveLength(2);
  });

  it("live のないクエリに live: true は渡せない", () => {
    expect(() => createUseList({} as never, { live: true })).toThrow(/live/);
  });
});

describe("createUseItem", () => {
  it("Get の関数で Item を読み、トークンも持つ", async () => {
    const get = async (key: { id: string }, options: { withToken: true }) => {
      void options;
      return { item: `v${key.id}`, token: "t" };
    };
    const useThing = createUseItem(get);
    const { result } = renderHook(() => useThing({ id: "1" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toMatchObject({
      status: "ready",
      item: "v1",
      token: "t",
    });
  });
});

describe("ApiProvider と useApi", () => {
  it("認証コンテキストを bind した API を返し、変われば作り直す", () => {
    const binds: unknown[] = [];
    const api = {
      bind: (ctx: unknown) => {
        binds.push(ctx);
        return { ctx, bind: api.bind };
      },
    };
    const wrapper = ({ children, ctx }: { children: ReactNode; ctx: string }) =>
      createElement(ApiProvider, { api, context: ctx }, children);
    let current = "a";
    const { result, rerender } = renderHook(() => useApi(api), {
      wrapper: ({ children }) => wrapper({ children, ctx: current }),
    });
    expect((result.current as unknown as { ctx: string }).ctx).toBe("a");
    current = "b";
    rerender();
    expect((result.current as unknown as { ctx: string }).ctx).toBe("b");
    expect(binds).toEqual(["a", "b"]);
  });

  it("ApiProvider の外ではエラー", () => {
    expect(() => renderHook(() => useApi())).toThrow(/ApiProvider/);
  });
});

describe("stableKey", () => {
  it("オブジェクトのキーの順によらず、Date・bigint・Set を区別する", () => {
    expect(stableKey({ a: 1, b: 2 })).toBe(stableKey({ b: 2, a: 1 }));
    expect(stableKey({ d: new Date(0) })).not.toBe(
      stableKey({ d: new Date(1) }),
    );
    expect(stableKey({ n: 1n })).not.toBe(stableKey({ n: 1 }));
    expect(stableKey(new Set(["b", "a"]))).toBe(stableKey(new Set(["a", "b"])));
    expect(stableKey(undefined)).toBe("undefined");
  });
});
