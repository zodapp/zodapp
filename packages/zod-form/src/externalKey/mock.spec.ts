import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  type MockExternalKeyOption,
} from "./mock";

describe("createMockTopic", () => {
  it("set した値を get で読め、購読者全員に届く", () => {
    const topic = createMockTopic(1);
    const a = vi.fn();
    const b = vi.fn();
    topic.subscribe(a);
    topic.subscribe(b);
    topic.set(2);
    expect(topic.get()).toBe(2);
    expect(a).toHaveBeenCalledWith(2);
    expect(b).toHaveBeenCalledWith(2);
  });

  it("関数を渡すと今の値から次の値を作る", () => {
    const topic = createMockTopic([1, 2]);
    topic.set((prev) => [...prev, 3]);
    expect(topic.get()).toEqual([1, 2, 3]);
  });

  it("購読をやめると届かなくなる", () => {
    const topic = createMockTopic("a");
    const listener = vi.fn();
    const unsubscribe = topic.subscribe(listener);
    unsubscribe();
    topic.set("b");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("createMockExternalKeyResolver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const option = (value: string): MockExternalKeyOption => ({
    label: value,
    value,
  });

  const setup = () => {
    const users = createMockTopic([option("u1")]);
    const entry = createMockExternalKeyResolver({
      delayMs: 100,
      topics: { users },
    });
    return { users, entry };
  };

  it("delayMs 待ってから、topic の今の選択肢を届ける", () => {
    const { entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "users" }, {}).subscribe(callback);
    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledWith([option("u1")]);
    vi.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("知らない topic は空の選択肢を一度返す", () => {
    const { entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "none" }, {}).subscribe(callback);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledWith([]);
    vi.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("topic を set すると届け直す", () => {
    const { users, entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "users" }, {}).subscribe(callback);
    vi.advanceTimersByTime(100);
    users.set((prev) => [...prev, option("u2")]);
    expect(callback).toHaveBeenLastCalledWith([option("u1"), option("u2")]);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("解除すると届かなくなり、topic の購読も外れる", () => {
    const { users, entry } = setup();
    const unsubscribeTopic = vi.fn();
    const subscribe = users.subscribe;
    vi.spyOn(users, "subscribe").mockImplementation((listener) => {
      const off = subscribe(listener);
      return () => {
        unsubscribeTopic();
        off();
      };
    });
    const callback = vi.fn();
    const unsubscribe = entry
      .resolver({ type: "mock", topic: "users" }, {})
      .subscribe(callback);
    vi.advanceTimersByTime(100);
    unsubscribe();
    expect(unsubscribeTopic).toHaveBeenCalledTimes(1);
    users.set([option("u2")]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("届く前に解除すると、何も届かず topic も購読しない", () => {
    const { users, entry } = setup();
    const subscribe = vi.spyOn(users, "subscribe");
    const callback = vi.fn();
    const unsubscribe = entry
      .resolver({ type: "mock", topic: "users" }, {})
      .subscribe(callback);
    vi.advanceTimersByTime(50);
    unsubscribe();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("config の delayMs が既定より優先される", () => {
    const { entry } = setup();
    const callback = vi.fn();
    entry
      .resolver({ type: "mock", topic: "users", delayMs: 3000 }, {})
      .subscribe(callback);
    vi.advanceTimersByTime(2999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("filter で絞り込み、contextId の resolverContext を受け取る。届けるのは label と value だけ", () => {
    const members = createMockTopic<MockExternalKeyOption[]>([
      { label: "山田", value: "u1", team: "sales" },
      { label: "佐藤", value: "u2", team: "dev" },
    ]);
    const entry = createMockExternalKeyResolver({
      delayMs: 0,
      topics: { members },
    });
    const filter = vi.fn(
      (option: MockExternalKeyOption, context: unknown) =>
        option.team === (context as { team: string }).team,
    );
    const callback = vi.fn();
    entry
      .resolver({ type: "mock", topic: "members", contextId: "team", filter }, {
        team: { team: "dev" },
      } as never)
      .subscribe(callback);
    vi.advanceTimersByTime(0);
    expect(filter).toHaveBeenCalledWith(
      { label: "山田", value: "u1", team: "sales" },
      { team: "dev" },
    );
    expect(callback).toHaveBeenLastCalledWith([{ label: "佐藤", value: "u2" }]);

    // topic が変わっても同じ filter で絞って届け直す
    members.set((prev) => [
      ...prev,
      { label: "鈴木", value: "u3", team: "dev" },
    ]);
    expect(callback).toHaveBeenLastCalledWith([
      { label: "佐藤", value: "u2" },
      { label: "鈴木", value: "u3" },
    ]);
  });
});
