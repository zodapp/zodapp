import { retentionCache } from "./retentionCache";

type Unsubscriber = () => void;

/**
 * 参照カウント付きの subscribe キャッシュ。
 *
 * 同じ `params` に対する購読を共有し、複数の callback を同一ストリームにぶら下げます。
 * 最後の購読解除後も `retentionTime` の間は購読を保持し、短時間の再購読で購読を作り直さないために使います。
 *
 * - **Params**: 購読キー（`serializer` で文字列化される）
 * - **Data**: emit されるデータ型
 */
export type SubscriptionCache<Params, Data> = {
  subscribe: (params: Params, callback: (data: Data) => void) => Unsubscriber;
  size: () => number;
};

type Generator<Params, Data> = (params: Params) => {
  subscribe: (emit: (data: Data) => void) => Unsubscriber;
};

type Entry<Data> = {
  initialized: boolean;
  lastData?: Data;
  listeners: Set<(data: Data) => void>;
  unsubscriber: Unsubscriber;
};

/**
 * 参照カウント付きの subscription キャッシュを作成します。
 *
 * 同じ `params` に対して generator の subscribe を共有し、複数 listener へ配信します。
 * 最後の unsubscribe 後も `retentionTime` の間は購読を保持し、短時間の再購読で再生成を避けます。
 */
export function subscriptionCache<Params, Data>(options: {
  generator: Generator<Params, Data>;
  retentionTime: number; // number固定にするのが安全（undefinedの意味で悩まない）
  serializer: (params: Params) => string;
}): SubscriptionCache<Params, Data> {
  const cache = retentionCache<Params, Entry<Data>>({
    factory: (params) => {
      const listeners = new Set<(data: Data) => void>();
      const entry: Entry<Data> = {
        initialized: false,
        listeners,
        unsubscriber: () => {},
      };
      entry.unsubscriber = options.generator(params).subscribe((data) => {
        entry.lastData = data;
        entry.initialized = true;
        for (const listener of listeners) {
          listener(data);
        }
      });
      return entry;
    },
    dispose: (entry) => {
      entry.unsubscriber();
    },
    serializer: options.serializer,
    retentionTime: options.retentionTime,
  });

  function hasLastData(
    entry: Entry<Data>,
  ): entry is Entry<Data> & { lastData: Data; initialized: true } {
    return entry.initialized === true;
  }

  function subscribe(
    params: Params,
    callback: (data: Data) => void,
  ): Unsubscriber {
    const { instance: entry, release } = cache.acquire(params);

    if (entry.listeners.has(callback)) {
      console.warn(
        "Callback already subscribed. Identical callback was subscribed multiple times",
      );
    }
    entry.listeners.add(callback);

    if (hasLastData(entry)) {
      callback(entry.lastData);
    }

    let unsubscribed = false;

    const unsubscribe = () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const removed = entry.listeners.delete(callback);
      if (!removed) {
        console.warn(
          "Unsubscribe called but callback was not subscribed. Identical callback was subscribed multiple times.",
        );
      }
      release();
    };
    return unsubscribe;
  }

  return {
    subscribe,
    size() {
      return cache.size();
    },
  };
}
