type Entry<V> = {
  instance: V;
  refCount: number;
  /** retentionTime 経過後に dispose するためのタイマー */
  cancelTimer?: ReturnType<typeof setTimeout>;
  disposed?: boolean;
};

/**
 * 参照カウント付きのキャッシュ。
 *
 * `acquire()` でインスタンスを取得し、対応する `release()` を呼ぶまでキャッシュは保持されます。
 * 最後の `release()` が呼ばれると、`retentionTime` の間だけ保持され、経過後に `dispose` されます。
 *
 * - **K**: キャッシュキーの型（`serializer` で文字列化される）
 * - **V**: キャッシュされるインスタンスの型
 */
export type RetentionCache<K, V> = {
  acquire: (key: K) => { instance: V; release: () => void };
  size: () => number;
};

/**
 * 参照カウント付きキャッシュを作成します。
 *
 * `acquire()` すると（必要なら）`factory` でインスタンスを生成し、参照カウントを増やします。
 * `release()` で参照カウントを減らし、最後の `release()` から `retentionTime` 経過後に `dispose` します。
 */
export function retentionCache<K, V>(options: {
  factory: (key: K) => V;
  dispose: (value: V) => void;
  serializer: (key: K) => string;
  retentionTime: number;
}): RetentionCache<K, V> {
  const cache = new Map<string, Entry<V>>();

  function stopDisposeTimer(entry: Entry<V>) {
    if (!entry.cancelTimer) return;
    clearTimeout(entry.cancelTimer);
    entry.cancelTimer = undefined;
  }

  function startDisposeTimer(serializedKey: string, entry: Entry<V>) {
    if (entry.cancelTimer) {
      // これは呼ばれないはずだが念のため
      clearTimeout(entry.cancelTimer);
    }
    entry.cancelTimer = setTimeout(() => {
      entry.cancelTimer = undefined;
      // retention中に再acquireが来ていたら dispose しない(起きてはいけない条件)
      if (entry.refCount > 0) {
        console.error("Internal error: invalid internal state");
        return;
      }
      // すでにdisposeされていたら dispose しない(起きてはいけない条件)
      if (entry.disposed) {
        console.error("Internal error: invalid internal state");
        return;
      }
      // すでにentryがcacheから削除されていたら dispose しない(起きてはいけない条件)
      if (cache.get(serializedKey) !== entry) {
        console.error("Internal error: invalid internal state");
        return;
      }
      entry.disposed = true;
      cache.delete(serializedKey);
      options.dispose(entry.instance);
    }, options.retentionTime);
  }

  function acquire(key: K): { instance: V; release: () => void } {
    const serializedKey = options.serializer(key);
    const entry =
      cache.get(serializedKey) ??
      (() => {
        const newEntry: Entry<V> = {
          instance: options.factory(key),
          refCount: 0,
        };
        cache.set(serializedKey, newEntry);
        return newEntry;
      })();

    entry.refCount++;
    stopDisposeTimer(entry);

    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      entry.refCount--;
      if (entry.refCount === 0) {
        startDisposeTimer(serializedKey, entry);
      }
    };

    return { instance: entry.instance, release };
  }

  return {
    acquire,
    size() {
      return cache.size;
    },
  };
}
