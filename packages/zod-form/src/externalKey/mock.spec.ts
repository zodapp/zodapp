import { describe, expect, it, vi } from "vitest";
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
    topic.set((prev) => [...(prev ?? []), 3]);
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

  it("初めの値を渡さないと、最初の set まで値が無い", () => {
    const topic = createMockTopic<number>();
    expect(topic.has()).toBe(false);
    expect(topic.get()).toBeUndefined();
    topic.set(1);
    expect(topic.has()).toBe(true);
    expect(topic.get()).toBe(1);
  });
});

describe("createMockExternalKeyResolver", () => {
  const option = (value: string): MockExternalKeyOption => ({
    label: value,
    value,
  });

  const setup = () => {
    const users = createMockTopic([option("u1")]);
    const pending = createMockTopic<MockExternalKeyOption[]>();
    const entry = createMockExternalKeyResolver({
      topics: { users, pending },
    });
    return { users, pending, entry };
  };

  it("topic に値があれば、購読したその場で今の選択肢を届ける", () => {
    const { entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "users" }, {}).subscribe(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([option("u1")]);
  });

  it("topic にまだ値が無ければ何も届けず、最初の set で届ける", () => {
    const { pending, entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "pending" }, {}).subscribe(callback);
    expect(callback).not.toHaveBeenCalled();
    pending.set([option("p1")]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([option("p1")]);
  });

  it("知らない topic は、購読したその場で空の選択肢を一度届ける", () => {
    const { entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "none" }, {}).subscribe(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([]);
  });

  it("topic を set すると届け直す", () => {
    const { users, entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "users" }, {}).subscribe(callback);
    users.set((prev) => [...(prev ?? []), option("u2")]);
    expect(callback).toHaveBeenLastCalledWith([option("u1"), option("u2")]);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("解除すると届かなくなる", () => {
    const { users, pending, entry } = setup();
    const callback = vi.fn();
    entry.resolver({ type: "mock", topic: "users" }, {}).subscribe(callback)();
    entry
      .resolver({ type: "mock", topic: "pending" }, {})
      .subscribe(callback)();
    users.set([option("u2")]);
    pending.set([option("p1")]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([option("u1")]);
  });

  it("filter で絞り込み、contextId の resolverContext を受け取る。届けるのは label と value だけ", () => {
    const members = createMockTopic<MockExternalKeyOption[]>([
      { label: "利用者 A", value: "u1", team: "sales" },
      { label: "利用者 B", value: "u2", team: "dev" },
    ]);
    const entry = createMockExternalKeyResolver({ topics: { members } });
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
    expect(filter).toHaveBeenCalledWith(
      { label: "利用者 A", value: "u1", team: "sales" },
      { team: "dev" },
    );
    expect(callback).toHaveBeenLastCalledWith([
      { label: "利用者 B", value: "u2" },
    ]);

    // topic が変わっても同じ filter で絞って届け直す
    members.set((prev) => [
      ...(prev ?? []),
      { label: "利用者 C", value: "u3", team: "dev" },
    ]);
    expect(callback).toHaveBeenLastCalledWith([
      { label: "利用者 B", value: "u2" },
      { label: "利用者 C", value: "u3" },
    ]);
  });
});
