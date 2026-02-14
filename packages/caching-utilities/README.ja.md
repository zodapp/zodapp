# @zodapp/caching-utilities

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/caching-utilities` は、zodapp 内部で使われている **小さなキャッシュ/キー生成ユーティリティ**です。

- `stableStringify`: オブジェクトのキー順を正規化して、安定したキー文字列を作る
- `retentionCache`: 参照カウント + retentionTime によるインスタンス保持キャッシュ
- `subscriptionCache`: 同一パラメータの購読を共有し、最後の値を即時配信できる購読キャッシュ
- 型: `RetentionCache`, `SubscriptionCache`

`@zodapp/zod-firebase-browser` の Firestore 購読共有（`querySync` 等）でも利用されています。

## インストール

```bash
pnpm add @zodapp/caching-utilities
```

## 要件

- Node.js / TypeScript プロジェクト向け

## クイックスタート

### `stableStringify`

```ts
import { stableStringify } from "@zodapp/caching-utilities";

const key = stableStringify({ b: 2, a: 1, c: undefined });
// => {"a":1,"b":2}
```

### `retentionCache`

```ts
import { retentionCache, stableStringify } from "@zodapp/caching-utilities";

const cache = retentionCache({
  factory: (key: { userId: string }) => ({ createdAt: Date.now(), key }),
  dispose: (_value) => {
    // 解放時の後処理（イベント解除、close など）
  },
  serializer: stableStringify,
  retentionTime: 10_000,
});

const { instance, release } = cache.acquire({ userId: "u1" });
// instance を利用
release(); // 参照カウントを減らし、retentionTime 後に dispose される
```

### `subscriptionCache`

```ts
import { subscriptionCache, stableStringify } from "@zodapp/caching-utilities";

type Params = { channelId: string };
type Data = { value: number };

const cache = subscriptionCache<Params, Data>({
  retentionTime: 10_000,
  serializer: stableStringify,
  generator: (params) => ({
    subscribe: (emit) => {
      // 例: 実際は Firestore の onSnapshot 等を置く
      const timer = setInterval(() => emit({ value: Date.now() }), 1000);
      console.log("subscribe", params);
      return () => {
        console.log("unsubscribe", params);
        clearInterval(timer);
      };
    },
  }),
});

const unsubscribe = cache.subscribe({ channelId: "c1" }, (data) =>
  console.log("data", data),
);
unsubscribe();
```

## API（抜粋）

- `stableStringify(value): string`
- `retentionCache({ factory, dispose, serializer, retentionTime }): RetentionCache<K, V>`
- `subscriptionCache({ generator, retentionTime, serializer }): SubscriptionCache<Params, Data>`
- `type RetentionCache<K, V> = { acquire(key: K): { instance: V; release(): void }; size(): number }`
- `type SubscriptionCache<Params, Data> = { subscribe(params: Params, cb: (data: Data) => void): () => void; size(): number }`

## 注意点

### `stableStringify` は「キー生成用途」向け

`stableStringify` は **JSON っぽい値**（プリミティブ、配列、プレーンオブジェクト）を想定した簡易実装です。

- `Date` / `Map` / `Set` などは意図どおりに文字列化されません（キー衝突し得ます）
- 循環参照は考慮していません

複雑な値をキーに含めたい場合は、`retentionCache` / `subscriptionCache` の `serializer` に **用途に合った関数**を渡してください。

## 関連

- `@zodapp/zod-firebase-browser`: Firestore 購読共有で `subscriptionCache` を利用

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
