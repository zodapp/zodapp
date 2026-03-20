import { describe, expect, it, vi } from "vitest";
import { hierarchicalWeakCache } from "./hierarchicalWeakCache";

describe("hierarchicalWeakCache", () => {
  it("同じキー参照列なら別の配列インスタンスでも同じ値を取得できる", () => {
    const cache = hierarchicalWeakCache<
      readonly [object, object],
      { name: string }
    >();
    const key1 = {};
    const key2 = {};
    const value = { name: "value" };

    cache.set([key1, key2], value);

    expect(cache.get([key1, key2])).toBe(value);
    expect(cache.has([key1, key2])).toBe(true);
  });

  it("共有プレフィックスを持つ別の枝を独立して保持できる", () => {
    const cache = hierarchicalWeakCache<readonly [object, object], string>();
    const rootKey = {};
    const branchA = {};
    const branchB = {};

    cache.set([rootKey, branchA], "a");
    cache.set([rootKey, branchB], "b");

    expect(cache.get([rootKey, branchA])).toBe("a");
    expect(cache.get([rootKey, branchB])).toBe("b");
  });

  it("getOrCreate は既存値がある場合 factory を再実行しない", () => {
    const cache = hierarchicalWeakCache<readonly [object, object], object>();
    const key1 = {};
    const key2 = {};
    const value = { id: "cached" };
    const factory = vi.fn(() => value);

    expect(cache.getOrCreate([key1, key2], factory)).toBe(value);
    expect(cache.getOrCreate([key1, key2], factory)).toBe(value);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("delete は対象の葉だけを削除し、他の枝には影響しない", () => {
    const cache = hierarchicalWeakCache<readonly [object, object], string>();
    const rootKey = {};
    const branchA = {};
    const branchB = {};

    cache.set([rootKey, branchA], "a");
    cache.set([rootKey, branchB], "b");

    expect(cache.delete([rootKey, branchA])).toBe(true);
    expect(cache.get([rootKey, branchA])).toBeUndefined();
    expect(cache.has([rootKey, branchA])).toBe(false);
    expect(cache.get([rootKey, branchB])).toBe("b");
    expect(cache.delete([rootKey, branchA])).toBe(false);
  });

  it("空配列キーはすべての API で拒否する", () => {
    const cache = hierarchicalWeakCache<
      readonly [object, ...object[]],
      object
    >();
    const emptyKeys = [] as unknown as readonly [object, ...object[]];

    expect(() => cache.get(emptyKeys)).toThrow(
      "hierarchicalWeakCache keys must not be empty",
    );
    expect(() => cache.has(emptyKeys)).toThrow(
      "hierarchicalWeakCache keys must not be empty",
    );
    expect(() => cache.delete(emptyKeys)).toThrow(
      "hierarchicalWeakCache keys must not be empty",
    );
    expect(() => cache.set(emptyKeys, {})).toThrow(
      "hierarchicalWeakCache keys must not be empty",
    );
    expect(() => cache.getOrCreate(emptyKeys, () => ({}))).toThrow(
      "hierarchicalWeakCache keys must not be empty",
    );
  });

  it("undefined の保存は実行時にも拒否する", () => {
    const cache = hierarchicalWeakCache<
      readonly [object],
      string | undefined
    >();
    const key = {};

    expect(() => cache.set([key], undefined as never)).toThrow(
      "hierarchicalWeakCache value must not be undefined",
    );
    expect(() => cache.getOrCreate([key], () => undefined as never)).toThrow(
      "hierarchicalWeakCache value must not be undefined",
    );
  });
});
