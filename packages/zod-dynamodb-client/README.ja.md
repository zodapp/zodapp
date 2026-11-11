# @zodapp/zod-dynamodb-client

`@zodapp/zod-dynamodb` の登録簿（`defineEndpoints`）から、ブラウザの API を作ります（設計は [docs/design.md](../../docs/zod-dynamodb/design.md) の §7.8、§10）。関数の形はサーバーの API（`createServerApi`）と同じです。ブラウザでも Node.js でも動きます。

```ts
import { createClient, isClientError } from "@zodapp/zod-dynamodb-client";
import { endpoints } from "./shared/endpoints";

export const api = createClient(endpoints, {
  baseUrl: "/api",
  headers: () => ({ authorization: `Bearer ${getToken()}` }), // 省略できる。非同期でもよい
  credentials: "include", // fetch にそのまま渡す
  realtime: { url: "wss://example.com/api/realtime" }, // live() を使うとき
});
```

## HTTP の呼び出し

```ts
const task = await api.tasks.get({ workspaceId: "ws1", taskId: "t1" }); // Item | null
const { item, token } = await api.tasks.get(key, { withToken: true });
await api.tasks.setStatus(key, { status: "done" }, { ifUnchanged: token });
const { items, cursor } = await api.tasks.byStatus(
  { workspaceId: "ws1", status: "todo" },
  { limit: 20, signal },
);
for await (const page of api.tasks.byStatus.pages({
  workspaceId: "ws1",
  status: "todo",
})) {
  /* 最後のページまで */
}
await api.tasks.remove(key); // ブラウザには削除前の Item を返さない（void）
```

- 引数は位置引数です。最後の `options` には `context`、`signal`、`headers`（この呼び出しだけのヘッダー）と、操作ごとのもの（`withToken`、`ifUnchanged`、`cursor`、`limit`、`fields`）を渡します
- 入力は送る前に Schema で検証します。失敗したら送らずに `INVALID_INPUT` の `ClientError` を投げます
- `GET` の操作では、入力全体の JSON をクエリ文字列の `input` に入れます。URL の長さには上限があるので、長い入力には `POST` を使ってください
- キーの引数には、キーのフィールドだけを渡してください。Item をそのまま渡すと、余分なフィールドとして検証で失敗します

**エラー**は `ClientError` で、`code` で判定します。

```ts
try {
  await api.tasks.setStatus(key, { status: "done" }, { ifUnchanged: token });
} catch (error) {
  if (isClientError(error, "CONFLICT")) {
    /* 他の更新と競合した */
  }
}
```

| `code`                                                                      | 意味                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| §7.5 のコード（`INVALID_INPUT`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT` など） | サーバーのエラー                                                                   |
| `NETWORK`                                                                   | 通信の失敗                                                                         |
| `UNEXPECTED_RESPONSE`                                                       | §7.5 の形でない応答（WAF やロードバランサーの 403・502 など）。`status` は保持する |
| `INVALID_RESPONSE`                                                          | 出力が操作の Schema に合わない（版ずれなど）                                       |
| `TOO_MANY_ITEMS`                                                            | 一覧の全件の取得で、件数の上限を超えた                                             |

`AbortSignal` での中止は、`AbortError` のまま投げます。

## 送る前の判定（`can`）

各関数は `can` を持ち、共有の定義の判定を、送らずに同期で行います。

```ts
api.context.set(auth); // ブラウザでの認証コンテキスト（グローバルな値）
api.tasks.setStatus.can(key, { status: "done" }, { item: task });
// { ok: true } | { ok: false, reason: "INVALID_INPUT" | "FORBIDDEN" | "CONDITION" | "NO_CONTEXT", issues? }

const bound = api.bind(auth); // 認証コンテキストを固定した API（SSR や React の ApiProvider で使う）
```

- 入力の検証、`authorize`、`where`（`item` を渡したときだけ）の順に判定します
- `can` は共有の規則での見込みです。サーバーの上書き（`override()`）は反映しないので、`ok` でもサーバーが上書きの規則で拒否する（`FORBIDDEN` など）ことはあります。最終の判定はサーバーが行います
- 認証コンテキストは、明示した `{ context }`、`bind` した値、`api.context.set()` の値の順に使います。`api.context.set()` はブラウザでだけ使えます（SSR のサーバーで呼ぶとエラー）
- HTTP では認証コンテキストを送りません。サーバーがリクエストのヘッダーから作ります

## 両側で動くコード

ブラウザの API とサーバーの API は同じ形なので、`SharedApi<typeof endpoints>` を引数に取る関数は、どちらでも動きます。

```ts
import type { SharedApi } from "@zodapp/zod-dynamodb";

export const finishAll = async (
  api: SharedApi<typeof endpoints>,
  workspaceId: string,
) => {
  for await (const page of api.tasks.all.pages({ workspaceId })) {
    for (const task of page.items) {
      const key = { workspaceId: task.workspaceId, taskId: task.taskId };
      if (api.tasks.setStatus.can(key, { status: "done" }, { item: task }).ok) {
        await api.tasks.setStatus(key, { status: "done" });
      }
    }
  }
};
```

## 一覧と Item の状態（store）

1 回きりの取得とリアルタイムの購読は、同じ状態の形を持ちます。ソースを替えるだけで切り替えられます。

```ts
const recent = api.tasks.byStatus.live(
  { workspaceId: "ws1", status: "todo" },
  { pageSize: 100 },
);
const off = recent.subscribe(() => render(recent.getState()));
// getState(): { status: "loading" | "ready" | "error", items, hasMore, isFetchingMore, error? }
recent.fetchMore(); // 次の 100 件を遡って読む
recent.close();

const once = onceListStore(api.tasks.byStatus, {
  workspaceId: "ws1",
  status: "todo",
}); // HTTP のクエリ
const task = onceItemStore(api.tasks.get, { workspaceId: "ws1", taskId: "t1" }); // { status, item, token? }
```

- `pageSize` を指定すると progressive（最初にその件数を読み、`fetchMore` で遡る）、省略すると最後のページまで読みます
- **大きな一覧は progressive で扱うのが原則です。** 全体を読むときの件数の上限は `maxSnapshotItems`（既定 10,000）で、超えたら `TOO_MANY_ITEMS` のエラーになります

## リアルタイムの購読（`live`）

`live` は、登録簿で `live` を付けたクエリだけが持ちます（`@zodapp/zod-dynamodb-realtime` の Gateway が公開するもの）。購読の名前は「グループ名.操作の名前」です。

- 接続は Client で 1 本だけ持ち、購読がなくなったら閉じます。切れたら間隔を広げながら再接続し、すべての購読を 1 からやり直します。読み直すまでは前の一覧を出したままにします
- 一覧は、ページと変更を `version` で突き合わせて Client で組み立てます。削除された Item は Tombstone として覚え、古いページで復活しないようにします
- progressive では、最後に読んだページの境界までを出します。新しい Item が来れば一覧はそのまま伸びます。境界より後の変更は 60 秒だけ覚えておき、遡って読んだページが古いときに直します
- 一括での書き込みは、既定では個々の変更を適用します。`{ onBatch: "reload" }` を指定すると、終わるまで待ってから読み直します
- ブラウザの `WebSocket` はヘッダーを付けられません。認証は Cookie で行うか、`url` を関数にしてトークンを入れてください（接続のたびに呼びます）

```ts
realtime: {
  url: async () => `wss://example.com/api/realtime?token=${await getToken()}`,
},
```
