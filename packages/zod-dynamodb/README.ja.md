# @zodapp/zod-dynamodb

Zodで定義したTable定義を基点に、DynamoDBを型安全に扱うための共通定義です。ブラウザとサーバーの両方で使えます（設計は [docs/design.md](../../docs/zod-dynamodb/design.md)）。

- `physicalTable()`：単一テーブルの物理レイアウト（GSIとベクトルインデックスのスロット）
- `tableConfig()`：item / create のSchemaをそのまま保持するTable定義。キーとIndexのフィールドを型と定義時に検査する。フック（`onCreate` / `onWrite`）と `generateKey` もここに書く
- キーのエンコーディング：文字列以外の値に `$` と型識別子を付ける方式で、一意・逆算可能・順序保存の物理キーを作る。逆算にSchemaを使わない
- `defineContext<Auth>()`：認証コンテキストの型を1回だけ宣言し、`createOps`、`override`、`defineEndpoints` を返す
- `createOps(table, (o) => ({ ... }))`：名前付きの操作（`o.get`、`o.create`、`o.createWithGeneratedKey`、`o.set`、`o.delete`、`o.mutation`、`o.query`、`o.search`）。`authorize`、`where`、`patch` も共有の定義に書く
- `defineEndpoints({ ... })`：公開する操作の登録簿。グループ、パス、HTTPメソッド、リアルタイム（`live`）を付ける。`defineContext` が返すものを使うと、別の `defineContext` の操作が混ざっていないかを型でも確かめる。サーバー専用の操作の `path`・`live`、クエリ以外の `live`、書き込みの `GET` は型のエラーになり、`method + path` の重なりは作成時のエラーになる
- `Api` / `ServerApi` / `SharedApi`：登録簿から決まるブラウザ・サーバー・両方で使える API の型
- `classifyChange()`：名前付きクエリの所属判定から `ADDED` / `MODIFIED` / `REMOVED` を決める

```ts
// shared/context.ts
export type Auth = { userId: string; workspaces: string[] };
export const { createOps, override, defineEndpoints } = defineContext<Auth>();

// shared/tasks.ts（ブラウザとサーバーで共有する）
export const tasks = tableConfig({
  table: appTable,
  entity: "Task",
  item: taskKeyFields.and(taskBody).and(timestamps),
  create: taskBody,
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["priority", "updatedAt"],
    },
  },
  onCreate: ({ now }) => ({ createdAt: now, updatedAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});

const inWorkspace = (ctx: Auth, workspaceId: string) =>
  ctx.workspaces.includes(workspaceId);

export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => inWorkspace(ctx, key.workspaceId),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => inWorkspace(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
    where: (_p, ctx) => ({ assignee: ctx.userId }), // 担当者だけが変更できる
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    authorize: (ctx, { params }) => inWorkspace(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
  purge: o.delete(), // authorize がない操作はサーバー専用
}));

// shared/endpoints.ts
export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    { op: taskOps.byStatus, path: "/tasks/by-status", live: true },
    { op: taskOps.purge },
  ],
});
```

ブラウザに出したくない規則や、サーバー専用のモジュールを使う処理だけを、サーバーで上書きします（design.md の §5.8）。

```ts
// サーバーだけ。createRepository({ overrides }) に渡す
export const overrides = [
  override(taskOps.setStatus, {
    authorize: (ctx, req, shared) =>
      shared(ctx, req) && !ctx.frozenWorkspaces.includes(req.key.workspaceId),
  }),
];
```

- 共有の定義の `authorize` は同期で `boolean` を返します（ブラウザの `can` でも使うため）。上書きの `authorize` も同期だけで（`Promise` を返すと `DefinitionError`）、最後の引数で共有の判定（`shared`）を受け取ります。認可に要るデータは、認証コンテキストを作るときに読んでおきます
- `item`・`create`・操作の `params` の Schema は、出力をもう一度通しても通るものに限ります。`transform`・`pipe`・`preprocess` は定義時にエラーになります（`default`・`coerce` は使えます）。ライブラリは認可の前に 1 回だけ検証し、その値で認可と書き込みを行います（design.md §5.4）
- `get`・`create`・`set` の `authorize` が見られるのは、キーと入力と認証コンテキストだけで、保存済みの Item は見られません。保存済みの値で判定したい書き込みは、ミューテーションや削除の `where`（DynamoDB の条件付き書き込み）を使います。`get` には条件を付けられないので、読み取りはキーに所有者やワークスペースを入れて `authorize` で判定するか、クエリにしてパラメーターで判定します
  - 例：キーが `noteId` だけのテーブルで `set` を公開すると、入力の `ownerId` を書き換えて他人のメモを上書きできます。`set` を公開せず、ミューテーションの `where: (_p, ctx) => ({ ownerId: ctx.userId })` で防ぎます
- 共有のモジュールは Node.js 専用のモジュールに依存しないでください（このパッケージ自体も ESLint の `no-restricted-imports` とテストで確かめています）
