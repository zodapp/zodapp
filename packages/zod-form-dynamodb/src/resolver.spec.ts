import type { ListState, ListStore } from "@zodapp/zod-dynamodb-client";
import { describe, expect, it, vi } from "vitest";
import { createDynamoExternalKeyResolver, labelOf, resolveQuery } from "./resolver";

type Item = Record<string, unknown>;

const members: Item[] = [
  { workspaceId: "w1", userId: "u1", displayName: "Alice", role: "owner" },
  { workspaceId: "w1", userId: "u2", displayName: "Bob", role: "viewer" },
];

/** 状態を外から変えられる live の store */
const createFakeLiveStore = () => {
  let state: ListState<Item> = {
    status: "loading",
    items: [],
    hasMore: false,
    isFetchingMore: false,
  };
  const listeners = new Set<() => void>();
  const store: ListStore<Item> & { set(items: Item[]): void } = {
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    fetchMore: () => {},
    reload: () => {},
    close: vi.fn(),
    set: (items) => {
      state = { ...state, status: "ready", items };
      for (const fn of listeners) fn();
    },
  };
  return store;
};

const resolverContext = { workspace: { workspaceId: "w1" } } as never;

const baseConfig = {
  type: "dynamodb" as const,
  contextId: "workspace",
  query: "members.byWorkspace",
  params: (ctx: { workspaceId: string }) => ({ workspaceId: ctx.workspaceId }),
  valueField: "userId",
  labelField: "displayName",
};

describe("resolveQuery", () => {
  it("グループ名と操作の名前で関数を引く", () => {
    const fn = async () => ({ items: [] });
    expect(resolveQuery({ members: { byWorkspace: fn } }, "members.byWorkspace")).toBe(fn);
  });

  it("見つからない名前や形の違う名前はエラー", () => {
    const api = { members: { byWorkspace: async () => ({ items: [] }) } };
    expect(() => resolveQuery(api, "members.nope")).toThrow(/unknown query/);
    expect(() => resolveQuery(api, "members")).toThrow(/unknown query/);
    expect(() => resolveQuery(api, "a.b.c")).toThrow(/unknown query/);
  });
});

describe("labelOf", () => {
  it("labelFormatter、labelField、valueField の順に使う", () => {
    const item = { userId: "u1", displayName: "Alice" };
    expect(labelOf({ valueField: "userId" }, item)).toBe("u1");
    expect(labelOf({ valueField: "userId", labelField: "displayName" }, item)).toBe("Alice");
    expect(
      labelOf(
        { valueField: "userId", labelField: "displayName", labelFormatter: (i) => `@${String(i.userId)}` },
        item,
      ),
    ).toBe("@u1");
  });
});

describe("createDynamoExternalKeyResolver", () => {
  it("live のクエリを購読し、変わるたびに選択肢を送る。解除で store を閉じる", () => {
    const store = createFakeLiveStore();
    const live = vi.fn(() => store);
    const api = { members: { byWorkspace: Object.assign(async () => ({ items: [] }), { live }) } };
    const entry = createDynamoExternalKeyResolver(api);
    expect(entry.type).toBe("dynamodb");

    const callback = vi.fn();
    const off = entry.resolver(baseConfig, resolverContext).subscribe(callback);
    expect(live).toHaveBeenCalledWith({ workspaceId: "w1" });
    expect(callback).not.toHaveBeenCalled(); // まだ loading

    store.set(members);
    expect(callback).toHaveBeenLastCalledWith([
      { label: "Alice", value: "u1" },
      { label: "Bob", value: "u2" },
    ]);

    off();
    expect(store.close).toHaveBeenCalled();
  });

  it("filter で絞り込む", () => {
    const store = createFakeLiveStore();
    const api = {
      members: { byWorkspace: Object.assign(async () => ({ items: [] }), { live: () => store }) },
    };
    const callback = vi.fn();
    createDynamoExternalKeyResolver(api)
      .resolver({ ...baseConfig, filter: (i) => i.role !== "viewer" }, resolverContext)
      .subscribe(callback);
    store.set(members);
    expect(callback).toHaveBeenLastCalledWith([{ label: "Alice", value: "u1" }]);
  });

  it("live がなければ、ページをたどって 1 回だけ読む", async () => {
    const fn = vi.fn(async (_params: unknown, options?: { cursor?: string }) =>
      options?.cursor
        ? { items: [members[1]!] }
        : { items: [members[0]!], cursor: "next" },
    );
    const callback = vi.fn();
    createDynamoExternalKeyResolver({ members: { byWorkspace: fn } }, { type: "members" })
      .resolver({ ...baseConfig, type: "members" }, resolverContext)
      .subscribe(callback);
    await vi.waitFor(() =>
      expect(callback).toHaveBeenLastCalledWith([
        { label: "Alice", value: "u1" },
        { label: "Bob", value: "u2" },
      ]),
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("resolverContext に contextId の値がなければエラー", () => {
    const api = { members: { byWorkspace: async () => ({ items: [] }) } };
    expect(() =>
      createDynamoExternalKeyResolver(api).resolver(baseConfig, {} as never),
    ).toThrow();
  });
});
