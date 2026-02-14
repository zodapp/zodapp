import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscriptionCache } from "./subscriptionCache";

type Params = { id: string };
type Data = string;

function createGenerator() {
  const emits: Array<(data: Data) => void> = [];
  const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];

  const generator = vi.fn((_params: Params) => {
    return {
      subscribe: (emit: (data: Data) => void) => {
        emits.push(emit);
        const unsubscriber = vi.fn();
        unsubscribers.push(unsubscriber);
        return unsubscriber;
      },
    };
  });

  return { generator, emits, unsubscribers };
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let allowWarn = false;
let allowError = false;

function allowConsoleCalls(options: { warn?: boolean; error?: boolean }) {
  if (options.warn) allowWarn = true;
  if (options.error) allowError = true;
}

beforeEach(() => {
  allowWarn = false;
  allowError = false;
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // 予期しない console 出力がないことを保証
  if (!allowWarn) expect(warnSpy).not.toHaveBeenCalled();
  if (!allowError) expect(errorSpy).not.toHaveBeenCalled();

  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("subscriptionCache", () => {
  it("同一キーでは generator は 1 回だけ作られ、emit が全 listener に配信される", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const unsub1 = cache.subscribe({ id: "a" }, cb1);
    const unsub2 = cache.subscribe({ id: "a" }, cb2);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);

    emits[0]!("x");
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith("x");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("x");

    unsub1();
    emits[0]!("y");
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenLastCalledWith("y");

    unsub2();
    expect(unsubscribers[0]).not.toHaveBeenCalled();
    expect(cache.size()).toBe(1); // retention 中は消えない

    vi.advanceTimersByTime(999);
    expect(unsubscribers[0]).not.toHaveBeenCalled();
    expect(cache.size()).toBe(1);

    vi.advanceTimersByTime(1);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("既存 entry に subscribe すると最後に emit されたデータが即時配信される", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb1 = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb1);

    emits[0]!("first");
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith("first");

    const cb2 = vi.fn();
    const unsub2 = cache.subscribe({ id: "a" }, cb2);

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("first");

    emits[0]!("second");
    expect(cb1).toHaveBeenCalledTimes(2);
    expect(cb1).toHaveBeenLastCalledWith("second");
    expect(cb2).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenLastCalledWith("second");

    unsub1();
    unsub2();
    vi.runAllTimers();
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
  });

  it("listener が 0 の間に emit されたデータも lastData として再配信される", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb1 = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb1);
    emits[0]!("v1");
    expect(cb1).toHaveBeenCalledTimes(1);

    unsub1();
    vi.advanceTimersByTime(500);

    emits[0]!("v2");

    const cb2 = vi.fn();
    const unsub2 = cache.subscribe({ id: "a" }, cb2);

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("v2");

    emits[0]!("v3");
    expect(cb2).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenLastCalledWith("v3");
    expect(cb1).toHaveBeenCalledTimes(1);

    unsub2();
    vi.advanceTimersByTime(1000);

    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("generator が subscribe 内で同期的に emit しても listener が受信する", () => {
    vi.useFakeTimers();
    const unsubscriber = vi.fn();
    const generator = vi.fn((_params: Params) => ({
      subscribe: (emit: (data: Data) => void) => {
        emit("immediate");
        return unsubscriber;
      },
    }));

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb = vi.fn();
    const unsubscribe = cache.subscribe({ id: "a" }, cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("immediate");

    unsubscribe();
    vi.runAllTimers();
    expect(unsubscriber).toHaveBeenCalledTimes(1);
  });

  it("最後の unsubscribe 後、retention 中の再購読で close タイマーがキャンセルされる", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb1 = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb1);
    expect(cache.size()).toBe(1);

    unsub1(); // timer start
    vi.advanceTimersByTime(500);

    const cb2 = vi.fn();
    const unsub2 = cache.subscribe({ id: "a" }, cb2); // timer cancel

    expect(generator).toHaveBeenCalledTimes(1);
    expect(unsubscribers[0]).not.toHaveBeenCalled();
    expect(cache.size()).toBe(1);

    // もし timer が生きていればここで close されるが、されないことを確認
    vi.advanceTimersByTime(2000);
    expect(unsubscribers[0]).not.toHaveBeenCalled();
    expect(cache.size()).toBe(1);

    emits[0]!("z");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("z");

    unsub2();
    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("retention 経過後は cache から削除され、次の subscribe で generator が再度呼ばれる", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb1 = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb1);
    expect(generator).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);

    unsub1();
    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);

    const cb2 = vi.fn();
    cache.subscribe({ id: "a" }, cb2);
    expect(generator).toHaveBeenCalledTimes(2);
    expect(cache.size()).toBe(1);

    emits[1]!("next");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("next");
  });

  it("キーが異なれば別 entry として管理される", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cbA = vi.fn();
    const cbB = vi.fn();
    const unsubA = cache.subscribe({ id: "a" }, cbA);
    const unsubB = cache.subscribe({ id: "b" }, cbB);

    expect(generator).toHaveBeenCalledTimes(2);
    expect(cache.size()).toBe(2);

    emits[0]!("a1");
    emits[1]!("b1");
    expect(cbA).toHaveBeenCalledWith("a1");
    expect(cbB).toHaveBeenCalledWith("b1");

    unsubA();
    unsubB();

    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(unsubscribers[1]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("同一 callback の二重 subscribe / unsubscribe は warn される", () => {
    vi.useFakeTimers();
    allowConsoleCalls({ warn: true });

    const { generator, unsubscribers } = createGenerator();
    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb);
    const unsub2 = cache.subscribe({ id: "a" }, cb);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);

    unsub1();
    unsub2();
    expect(warnSpy).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("最後の listener ではない unsubscribe では close タイマーは開始されない", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb1);
    const unsub2 = cache.subscribe({ id: "a" }, cb2);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);

    // cb1 だけ解除しても、cb2 が残っている間は close されない
    unsub1();
    vi.advanceTimersByTime(2000);
    expect(unsubscribers[0]).not.toHaveBeenCalled();
    expect(cache.size()).toBe(1);

    emits[0]!("still-alive");
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("still-alive");

    // 最後の listener を解除したら retention が開始される
    unsub2();
    vi.advanceTimersByTime(999);
    expect(unsubscribers[0]).not.toHaveBeenCalled();
    expect(cache.size()).toBe(1);

    vi.advanceTimersByTime(1);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("同じ unsubscribe を複数回呼んでも副作用はなく、close は 1 回だけ行われる", () => {
    vi.useFakeTimers();
    const { generator, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb = vi.fn();
    const unsubscribe = cache.subscribe({ id: "a" }, cb);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);

    unsubscribe();
    unsubscribe(); // no-op

    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("retentionTime=0 でも unsubscribe 後に即 close される", () => {
    vi.useFakeTimers();
    const { generator, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 0,
      serializer: (p) => p.id,
    });

    const cb = vi.fn();
    const unsubscribe = cache.subscribe({ id: "a" }, cb);
    expect(cache.size()).toBe(1);

    unsubscribe();
    // setTimeout(0) を実行
    vi.runAllTimers();

    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("serializer が衝突すると params が異なっても同一 entry として扱われる（危険な条件の明文化）", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: () => "same-key",
    });

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = cache.subscribe({ id: "a" }, cb1);
    const unsub2 = cache.subscribe({ id: "b" }, cb2);

    expect(generator).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(1);

    emits[0]!("collision");
    expect(cb1).toHaveBeenCalledWith("collision");
    expect(cb2).toHaveBeenCalledWith("collision");

    unsub1();
    unsub2();
    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });

  it("emit 中に自分自身を unsubscribe しても内部状態が壊れない（次の emit では呼ばれない）", () => {
    vi.useFakeTimers();
    const { generator, emits, unsubscribers } = createGenerator();

    const cache = subscriptionCache<Params, Data>({
      generator,
      retentionTime: 1000,
      serializer: (p) => p.id,
    });

    const cb = vi.fn((_data: Data) => {
      unsubscribe();
    });
    const unsubscribe = cache.subscribe({ id: "a" }, cb);

    emits[0]!("first");
    expect(cb).toHaveBeenCalledTimes(1);

    emits[0]!("second");
    expect(cb).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
  });
});
