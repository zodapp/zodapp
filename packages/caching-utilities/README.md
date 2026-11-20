# @zodapp/caching-utilities

[日本語](README.ja.md)

## Overview

`@zodapp/caching-utilities` is a set of **small caching / key generation utilities** used inside zodapp.

- `stableStringify`: normalizes the key order of an object to produce a stable key string
- `retentionCache`: a cache that keeps instances alive with reference counting + retentionTime
- `subscriptionCache`: a subscription cache that shares subscriptions with the same parameters and can deliver the last value immediately
- Types: `RetentionCache`, `SubscriptionCache`

It is used, for example, to share subscriptions of foreign key resolvers (`externalKey` in `@zodapp/zod-form`).

## Installation

```bash
pnpm add @zodapp/caching-utilities
```

## Requirements

- For Node.js / TypeScript projects

## Quick start

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
    // Cleanup on release (removing listeners, close, etc.)
  },
  serializer: stableStringify,
  retentionTime: 10_000,
});

const { instance, release } = cache.acquire({ userId: "u1" });
// use instance
release(); // decrements the reference count; disposed after retentionTime
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
      // Example: in practice, put a realtime subscription here (WebSocket, etc.)
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

## API (excerpt)

- `stableStringify(value): string`
- `retentionCache({ factory, dispose, serializer, retentionTime }): RetentionCache<K, V>`
- `subscriptionCache({ generator, retentionTime, serializer }): SubscriptionCache<Params, Data>`
- `type RetentionCache<K, V> = { acquire(key: K): { instance: V; release(): void }; size(): number }`
- `type SubscriptionCache<Params, Data> = { subscribe(params: Params, cb: (data: Data) => void): () => void; size(): number }`

## Notes

### `stableStringify` is meant for generating keys

`stableStringify` is a simple implementation that assumes **JSON-like values** (primitives, arrays, plain objects).

- `Date` / `Map` / `Set` and the like are not stringified as intended (keys may collide)
- Circular references are not handled

To include complex values in keys, pass **a function suited to your use** as the `serializer` of `retentionCache` / `subscriptionCache`.

## Related

- `@zodapp/zod-form`: refers to `SubscriptionCache` in the foreign key resolver types

## License

MIT ([`LICENSE`](../../LICENSE))
