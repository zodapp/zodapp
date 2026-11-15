import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockExternalKeyResolver } from "./mock";

describe("createMockExternalKeyResolver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const entry = createMockExternalKeyResolver({
    delayMs: 100,
    sources: {
      users: (_params, tick) => [{ label: `u${tick}`, value: `u${tick}` }],
      cities: ({ prefecture }) =>
        prefecture === "tokyo" ? [{ label: "新宿区", value: "shinjuku" }] : [],
    },
  });

  it("delayMs 待ってから、params を渡した出どころの選択肢を一度届ける", () => {
    const callback = vi.fn();
    entry
      .resolver(
        { type: "mock", source: "cities", params: { prefecture: "tokyo" } },
        {},
      )
      .subscribe(callback);
    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledWith([
      { label: "新宿区", value: "shinjuku" },
    ]);
    vi.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("updateIntervalMs を指定すると、その間隔で届け直し、解除で止まる", () => {
    const callback = vi.fn();
    const unsubscribe = entry
      .resolver({ type: "mock", source: "users", updateIntervalMs: 1000 }, {})
      .subscribe(callback);
    vi.advanceTimersByTime(100 + 2000);
    expect(callback.mock.calls.map(([options]) => options[0].value)).toEqual([
      "u0",
      "u1",
      "u2",
    ]);
    unsubscribe();
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("知らない出どころは空の選択肢を返す", () => {
    const callback = vi.fn();
    entry.resolver({ type: "mock", source: "none" }, {}).subscribe(callback);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledWith([]);
  });
});
