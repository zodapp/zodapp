# ブラウザの API

[English](client-api.md)

## Client

Clientは、登録簿を実体としてimportし、ブラウザの API を作る。関数の形は、サーバーの API（[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md)）と同じである。

```ts
import { createClient } from "@zodapp/zod-dynamodb-client";

export const api = createClient(endpoints, {
  baseUrl: "/api",
  credentials: "include",
  realtime: { url: "wss://example.com/api/realtime" }, // live() を使うとき
});

const task = await api.tasks.get({ workspaceId: "ws1", taskId: "t1" });
const { item, token } = await api.tasks.get(key, { withToken: true });
await api.tasks.setStatus(key, { status: "done" }, { ifUnchanged: token });
const { items, cursor } = await api.tasks.byStatus({
  workspaceId: "ws1",
  status: "todo",
  minPriority: 0,
});
for await (const page of api.tasks.byStatus.pages(params)) {
  /* ... */
}
```

- 引数は位置引数で、Getとdeleteは `(key, options?)`、createとsetは `(key, input, options?)`、生成するキーの作成は `(args, input, options?)`、ミューテーションは `(key, params, options?)`、クエリと検索は `(params, options?)` とする。`options` には、`context`、`signal`（中止）、`headers`（この呼び出しだけのヘッダー）と、操作ごとのもの（`withToken`、`ifUnchanged`、`cursor`、`limit`、`fields`）を渡す
- 戻り値は、Getが `Item | null`（`withToken: true` なら `{ item, token? }`）、作成・置換・ミューテーションが `Item`、deleteが `void`（ブラウザには削除前のItemを返さない）、クエリが `{ items, cursor? }`、検索が `{ item, score }[]` である
- Clientは、登録簿からパス、HTTPメソッド、入出力のSchemaを得る。値の変換は [値の変換](../../zod-dynamodb/docs/protocol.ja.md) のtransportで行う
- 送る前に入力をSchemaで検証し、失敗したら送らずに `INVALID_INPUT` にする
- エラーは `ClientError` として投げる。`code` は [エラー](../../zod-dynamodb/docs/protocol.ja.md) のコードに、Clientだけのコード（`NETWORK`：通信の失敗、`UNEXPECTED_RESPONSE`：[エラー](../../zod-dynamodb/docs/protocol.ja.md) の形でない応答、`INVALID_RESPONSE`：出力の検証の失敗、`TOO_MANY_ITEMS`：一覧の件数の上限の超過）を足したもの。`isClientError(error, "NOT_FOUND")` で `code` を絞り込める。`AbortSignal` での中止は `AbortError` のまま投げる
- `GET` のエンドポイントでは、パスのパラメーターを埋め、入力全体のJSONをクエリ文字列の `input` に入れる。サーバーでは router が読む（[入力の読み出し](../../zod-dynamodb-express/README.ja.md)）
- クエリの関数は `pages(params)` を持ち、`cursor` を引き継ぎながら最後のページまで順に取る

**送る前の判定（`can`）**

各関数は `can` を持ち、共有の定義（[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）の判定を、送らずに同期で行う。ボタンの有効・無効などに使う。

```ts
api.context.set(auth); // ブラウザでの認証コンテキスト（グローバルな値）
const r = api.tasks.setStatus.can(key, { status: "done" }, { item: task });
// { ok: true } | { ok: false, reason: "INVALID_INPUT" | "FORBIDDEN" | "CONDITION" | "NO_CONTEXT", issues? }
```

- 入力の検証、`authorize`、`where`（`item` を渡したときだけ）の順に判定する。`item` を渡さなければ、`where` は判定しない
- `can` は共有の規則での見込みで、サーバーの上書き（[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）は反映しない。`can` が `ok` でも、サーバーが上書きの規則で拒否する（`FORBIDDEN` など）ことはある。最終の判定はサーバーで、サーバーの API の `can` も同じく共有の定義だけで判定する
- 認証コンテキストは、明示した `{ context }`、`bind(ctx)` で固定した値、`api.context.set()` のグローバルな値の順に使う。`context` キーを書いたら、値が `null` / `undefined` でも「認証コンテキストなし」として扱い、`bind` やグローバルの値には戻らない（[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md) と同じ規則）。グローバルな値はブラウザでだけ使え、SSRのサーバーで設定するとエラーにする（リクエストをまたいで漏れるため）。SSRでは `bind` を使う
- HTTPでは認証コンテキストを送らない。サーバーはリクエストのヘッダーから作る（[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md)）

**両側で動くコード（`SharedApi`）**

ブラウザの API とサーバーの API は同じ形なので、両方で動く業務ロジックを1つ書ける。引数の型には `SharedApi<typeof endpoints>` を使う。ブラウザで呼べる操作（`authorize` と `path` を持つもの）だけを含み、`live` は含まない。

```ts
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

await finishAll(api, "ws1"); // ブラウザ（HTTP）
await finishAll(serverApi, "ws1"); // サーバー（認証コンテキストのスコープの中で）
```

- キーの引数は、キーのフィールドだけを渡す。Itemをそのまま渡すと、キーの検証で余分なフィールドとしてエラーになる

**一覧とItemの状態（store）**

一覧の状態は、Client の中のフレームワーク非依存の store に置く。1回きりの取得とリアルタイムの購読（[リアルタイムの同期](live-sync.ja.md)）は、同じ状態の形を持ち、ソースを替えるだけで切り替えられる。

```ts
const live = api.tasks.byStatus.live(params, { pageSize: 100 }); // リアルタイム（登録簿で live を付けたクエリ）
const once = onceListStore(api.tasks.byStatus, params, { pageSize: 100 }); // HTTPのクエリ
// getState(): { status: "loading" | "ready" | "error", items, hasMore, isFetchingMore, error? }
live.subscribe(() => render(live.getState()));
live.fetchMore();
live.close();

const item = onceItemStore(api.tasks.get, { workspaceId: "ws1", taskId: "t1" }); // { status, item, token?, error? }
```

- `pageSize` を指定すると progressive（最初にその件数を読み、`fetchMore` で同じ件数ずつ遡る）、省略すると最後のページまで読む（全体）。全体の件数の上限は `maxSnapshotItems`（既定 10,000）で、超えたら `TOO_MANY_ITEMS` のエラーにする
- `live` の購読の名前は「グループ名.操作の名前」（`tasks.byStatus`）とする

**React**

Reactのhooksは `@zodapp/zod-dynamodb-react` で提供する。hooksは store を `useSyncExternalStore` で読むだけで、状態の管理は持たない。関数を部分適用した hook を、コンポーネントの外で作る。

```tsx
export const useTodos = createUseList(api.tasks.byStatus, { live: true });
export const useTask = createUseItem(api.tasks.get);

<ApiProvider api={api} context={auth}>
  <App />
</ApiProvider>;

// コンポーネントの中
const { items, fetchMore } = useTodos(params, { pageSize: 100 });
const { status, item, token } = useTask(key);
const api = useApi(); // 認証コンテキストを bind した API（描画中の can に使う）
```

- store は描画中には作らず、購読したときに作り、購読者がいなくなったら閉じる。`params` と `options` が値として変わったときだけ作り直す
- `ApiProvider` は、認証コンテキストを `bind` した API を子に渡す。`useApi()` は、`ApiProvider` の外で呼ぶとエラーにする
