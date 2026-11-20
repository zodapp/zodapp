# 共有の定義、登録簿、認可

[English](shared-definitions.md)

## 共有の定義と、サーバーだけの上書き

Table定義と名前付きの操作は、**ブラウザとサーバーで共有する1つの定義**として書く。認可（`authorize`）、書き込みの条件（`where`）、部分更新（`patch`）も、原則として共有の定義に入れる。ブラウザに出したくない規則や、サーバー専用のモジュールを使う処理だけを、サーバーで**上書き**（`override()`）する。

```ts
// shared/context.ts（アプリで1回だけ）
export type Auth = { userId: string; workspaces: string[] };
export const { createOps, override, defineEndpoints } = defineContext<Auth>();

// shared/tasks.ts（共有。ブラウザでも動く）
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    patch: (p) => ({ status: p.status }),
    where: (_p, ctx) => ({ assignee: ctx.userId }), // 担当者だけが変更できる
  }),
  purge: o.delete(), // authorize がない操作はサーバー専用
}));

// server/overrides.ts（サーバー専用）
export const overrides = [
  override(taskOps.setStatus, {
    // 共有の判定（shared）に、サーバーだけの判定を足す。同期の関数だけ（必要なデータは認証コンテキストに入れておく）
    authorize: (ctx, req, shared) =>
      shared(ctx, req) && !ctx.frozenWorkspaces.includes(req.key.workspaceId),
  }),
];
```

共有を原則にする理由は次のとおりである。

- ブラウザでも同じ判定を、送る前に同期で行える（`can`。[ブラウザの API](../../zod-dynamodb-client/docs/client-api.ja.md)）。ボタンの有効・無効と、サーバーの判定がずれない
- 同じ関数（`api.tasks.setStatus(key, params)`）を、ブラウザでもサーバーでも呼べる。両方で動く業務ロジックを1つ書ける（`SharedApi`。[ブラウザの API](../../zod-dynamodb-client/docs/client-api.ja.md)）
- 定義が1か所にまとまり、契約と実装を往復せずに読める

| 定義                        | 共有の定義                                                                                                                                                     | サーバーだけ                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table定義（`tableConfig`）  | 物理レイアウト、エンティティ名、`item` / `create`、キー、Index、`immutable`、フック（`onCreate` / `onWrite`）、`generateKey`、ベクトルスロットの静的な割り当て | ベクトルの実行時の設定（`createRepository` の `vectors` と `resolveVectorConfig`。[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)） |
| 操作（`createOps`）         | 名前、`params`、`authorize`、クエリの条件、ミューテーションの `patch` / `add` / `where`、削除の `where`、検索の `partition` / `filters`                        | 上書き（`override()`）：`authorize`（同期だけ）、ミューテーションと削除の `patch` / `where`、検索の `queryVector`（必須）                            |
| 登録簿（`defineEndpoints`） | グループ、パス、HTTPメソッド、リアルタイム（`live`）、Subscriptionの `fields`                                                                                  | なし                                                                                                                                                 |

- 上書きの関数は、最後の引数で共有の関数（`shared`）を受け取る。呼べば共有の判定に足す形に、呼ばなければ置き換えになる。上書きは `createRepository({ overrides })` に渡す。同じ操作への上書きを2回渡すとエラーにする
- `authorize` を持たない操作は**サーバー専用**とし、登録簿にパスを付けられない。ブラウザの API にも現れない。クエリならリアルタイム（`live`）は付けられ、書き込み側は発行するが、Realtime Gateway は公開しない（サーバーのコードが `subscribeOnServer` で購読する。[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）
- フックや `generateKey` は Table定義に書くが、呼ばれるのはサーバー（Repository）だけである。共有のモジュールに置くので、サーバー専用のモジュールには依存させない。依存が必要な場合は、その処理を名前付きミューテーションにして上書きで書く
- 共有のモジュールは、Node.js専用のモジュールに依存しないことをテストで確かめる。共通のユーティリティ（IDの書式の検査、`buildFilters` など）は入れてよい。ライブラリのブラウザ向けのパッケージ（`zod-dynamodb`、`zod-dynamodb-client`、`zod-dynamodb-react`）は、Node.jsの組み込みのモジュール（`node:*`）、サーバーのパッケージ、`@aws-sdk/*` を import しないことを、ESLint の `no-restricted-imports` とテスト（`browser-safe.spec.ts`）で確かめる
- [Repository](../../zod-dynamodb-node/docs/repository.ja.md) は、Table定義と上書きを受け取って作る

**`authorize` が見られるもの（Getと書き込みの認可の範囲）**

- `get`・`create`・`set`・`createWithGeneratedKey` の `authorize` が見られるのは、キーと入力（送られてきた値）と認証コンテキストだけで、保存済みのItemは見られない
- 保存済みの値で判定したい書き込みは、ミューテーションや削除の `where` を使う。`where` はDynamoDBの条件付き書き込み（`ConditionExpression`）なので、使えるのはミューテーションと削除だけである。読み取り（`get`）には、DynamoDBの仕組みの上で条件を付けられない
- 読み取りを守るには、キーに所有者やワークスペースを入れて `authorize` がキーで判定できるようにするか、一覧をクエリにしてパラメーターで判定する
- 例：キーが `noteId` だけのテーブルで `set` を公開すると、入力の `ownerId` を書き換えて他人のメモを上書きできる。`set` を公開せず、ミューテーションの `where: (_p, ctx) => ({ ownerId: ctx.userId })` で「保存済みの所有者が自分」の場合だけ書き込む

## 登録簿

公開する操作は、アプリケーションが共有モジュールに**登録簿**（`defineEndpoints`）として書く。登録簿は、操作（`createOps` で作ったもの）を、グループに分けて並べ、パス、HTTPメソッド、リアルタイム（`live`）を付けたものである。ブラウザの API（[ブラウザの API](../../zod-dynamodb-client/docs/client-api.ja.md)）、[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md) と [router](../../zod-dynamodb-express/README.ja.md)、[Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)は、すべてこの登録簿から作る。

```ts
// shared/endpoints.ts（共有。アプリケーションが書く）
import { defineEndpoints } from "./context"; // defineContext<Auth>() が返したもの（「共有の定義と、サーバーだけの上書き」）

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    {
      op: taskOps.getByPath,
      path: "/tasks/:workspaceId/:taskId",
      method: "GET",
    },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.remove, path: "/tasks/delete" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    {
      op: taskOps.byStatus,
      path: "/tasks/by-status",
      live: { fields: { omit: ["description"] } },
    },
    { op: taskOps.purge }, // サーバー専用（authorize がない）。サーバーの API にだけ現れる
  ],
  rows: [{ op: rowOps.similar, path: "/rows/similar" }],
});
```

- 操作の種類は、Get、Create（生成するキーの作成を含む）、Set（全体置換。[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）、Delete、Mutation（名前付きミューテーション）、Query（名前付きクエリ）、Search（名前付きの検索。[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)）とする。どれを公開するかはアプリケーションが決める
- 関数の名前は、`createOps` で付けた操作の名前になる（`api.tasks.setStatus`）。同じグループで名前が重なる場合や、同じ操作を2つのグループに登録した場合は、作成時にエラーにする
- パスとHTTPメソッドは、アプリケーションが決める。ライブラリはパスの構造を定めない。HTTPメソッドの既定は `POST` で、入力をbodyに入れる。`path` のない操作はHTTPでは公開しない（リアルタイムだけ、またはサーバーだけで使う）
- `GET` を選び、パスにパラメーターを含める場合は、Clientが入力の同名のフィールドでパスを埋める。サーバー側の読み出し方は [zod-dynamodb-express の README](../../zod-dynamodb-express/README.ja.md)
- `live` はクエリにだけ付けられる。`live: true` か、Subscriptionの `fields` を指定したオブジェクト（[Subscription定義](realtime.ja.md)）とする
- `authorize` を持たない操作（サーバー専用。「共有の定義と、サーバーだけの上書き」）には、`path` を付けられない。`live` は付けられるが、Realtime Gateway は公開しない
- `GET` を付けられるのは、読み取りの操作（Get、Query、Search）だけとする
- `method` と `path` の組が重なる場合は、作成時にエラーにする。Express のパラメーター（`:name`）は名前によらず同じものとして比べる（`/a/:id` と `/a/:key` は重なる）。`handle()`（[zod-dynamodb-express](../../zod-dynamodb-express/README.ja.md)）で個別に公開するパスは、登録簿の外なので比べない
- 登録簿のすべての操作は、同じ `defineContext` の `createOps` で作ったものとする。`defineContext` が返す `defineEndpoints` を使うことを勧める。これは、型でも Auth の型が同じことを確かめ、実行時にもその `defineContext` の操作だけを受け付ける。`@zodapp/zod-dynamodb` から直接取り出す `defineEndpoints` は、実行時にだけ「すべての操作が同じ `defineContext` から作られていること」を確かめる。上書き（`override()`）も同じで、別の `defineContext` の操作を上書きしたり、登録簿と違う `defineContext` の上書きを `createRepository` に渡したりすると、エラーにする
- これらの検査は、作成時の `DefinitionError` で行う。サーバー専用の操作への `path`、クエリ以外への `live`、書き込みへの `GET`、別の Auth の操作は、型のエラーにもなる（エラーは該当のプロパティに出る）。名前の重なりと `method + path` の重なりは、実行時にだけ確かめる
- 各操作の入力と出力のSchemaは、操作の定義から決まる。アプリケーションがSchemaを書き直す必要はない
- Table定義をまるごと公開する汎用のエンドポイントは作らない。公開する操作は1つずつ書く
- グループ名には、ブラウザの API とサーバーの API が使う予約の名前（`context`、`endpoints`、`bind`、`execute` など）を使えない
- パスのパラメーターを埋める補助として `buildPath(path, 入力のJSON)` を用意する。入力の直下、`key`、`params` の順に同名のフィールドを探す

## 認証と認可

認証はアプリケーション側で行い、認可は操作ごとにライブラリが確かめる。ログイン済みであっても、別のワークスペースのItemを読み取ってよいとは限らないためである。

ブラウザに公開する操作は、`authorize` を持つものに限る。`authorize` のない操作はサーバー専用になり、登録簿にパスを付けると作成時にエラーにする（`live` は付けられるが、Realtime Gateway は公開しない）。認可処理が未設定の場合に無条件でアクセスを許可する設計にはしない。すべて許可する操作は、`authorize: () => true` と明示して書く。

共有の定義の `authorize` も、サーバーだけの上書きの `authorize` も、同期で `boolean` を返す（ブラウザの `can` で使うため。また、Realtime Gateway が変更の配信のたびに呼ぶため）。上書きが `Promise` を返したら `DefinitionError` にする。認可に要るデータは、認証コンテキストを作るときに読む（[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md)）。`false` なら `FORBIDDEN`（[エラー](protocol.ja.md)）を返す。上書きの中で `ForbiddenError` を投げても同じである。拒否の理由はクライアントに返さない。理由を残したい場合は、アプリケーションが `authorize` の中でログに書く。

`authorize(ctx, request)` の `request` は、操作の種類に応じて次のものを受け取る。

| 操作                     | `request`                                                            |
| ------------------------ | -------------------------------------------------------------------- |
| Get                      | `{ key }`                                                            |
| Create                   | `{ key, input }`（生成するキーの場合は `{ args, input }`）           |
| Set                      | `{ key, input }`                                                     |
| 名前付きミューテーション | `{ key, params }`                                                    |
| Delete                   | `{ key }`                                                            |
| 名前付きクエリ           | `{ params }`                                                         |
| 名前付きの検索           | `{ params }`                                                         |
| Subscription             | 購読するクエリの `{ params }`（クエリの `authorize` をそのまま使う） |

Queryの認可は、取得後にItemを間引くとPaginationや件数制限に問題が生じるため、パラメーターに対して行う。

認可関数はItemを読み取らずに判定する。更新前の状態を使う認可（担当者だけが変更できる、確定したものは変更できない、など）は、ミューテーションや削除の `where` 条件として書く（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）。条件は書き込みと同じリクエストで評価されるため、判定後に状態が変わる競合は起きない。親のフィールドを使う認可は、子に `immutable` のフィールドとして持たせて `where` で表す（[Table定義](table-definition.ja.md) の `immutable`）。

フィールド単位の制限（更新してよいフィールド）は、名前付きミューテーションが書き込むフィールドによって表す。
