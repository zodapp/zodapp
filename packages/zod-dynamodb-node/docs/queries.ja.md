# 名前付きクエリと読み取り

[English](queries.md)

## 名前付きクエリ

DynamoDBでは、任意のフィールドを自由に検索できるわけではない。

そのため、**クエリはすべて名前付きで宣言し、クライアントからは名前とパラメーターだけを指定できる**ようにする。任意の条件を組み立てるAPIは公開しない。

```ts
export const taskOps = createOps(tasks, (o) => ({
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
      minPriority: z.int(),
    }),
    authorize: (ctx, { params }) => ctx.workspaces.includes(params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
      sort: { priority: { gte: p.minPriority } },
    }),
    direction: "desc",
  }),

  byAssignee: o.query({
    index: "byAssignee",
    params: z.object({
      workspaceId: z.string(),
      assignee: z.string().nullable(),
    }),
    authorize: (ctx, { params }) => ctx.workspaces.includes(params.workspaceId),
    select: "projection", // 射影だけを返す
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, assignee: p.assignee },
    }),
  }),
}));
```

`createOps` のビルダー（`o.query` など）で受け取るのは、`params` からの型推論を操作ごとに閉じるためである。操作の名前は、返すオブジェクトのキーになる。`where` は認証コンテキストも受け取れる（`where: (p, ctx) => ...`）。

### 条件

クエリの条件は、**Partition Keyの等値条件とSort Keyの条件に限った宣言的な形**とする。DynamoDBの式を返す関数にはしない。

- `partition`：IndexのPartition Keyのフィールドすべてに値を与える
- `sort`：IndexのSort Keyのフィールドの**先頭から順に** k 個を等値で指定し、続く1個に範囲条件（`gt` / `gte` / `lt` / `lte` / `beginsWith`）を付けられる。先頭を飛ばした指定はコンパイルエラーになる
  - 内部では、等値の部分を `begins_with(SK, "<entity>#v1#…#vk#")` に、範囲条件を `BETWEEN` などに変換する。上限側の境界には区切り文字の次の文字を使う。どちらも [キーのエンコーディング](../../zod-dynamodb/docs/physical-layout.ja.md) の順序保存の条件があるから成り立つ

宣言的にしておくことで、同じ定義から次の2つを得られる。

- DynamoDBに対するQueryの実行
- JS上での所属判定 `matches(doc, params)`（リアルタイム配信のADDED / REMOVED判定に使う。[変更イベントの生成](../../zod-dynamodb/docs/realtime.ja.md)）

所属判定は属性の値を比べるだけなので、itemがunionであっても成立する。

### 結果の型と読み方

結果の型は、そのIndexに載るvariantだけに絞り、Indexのフィールドから `undefined` を除いたものになる。例えば `byStatus` の結果は `kind: "todo"` のvariantだけになる。

`select` で、全体を返すか射影だけを返すかを選ぶ。既定は全体である。

| スロットの射影 | `select: "full"`（既定）                | `select: "projection"`                          |
| -------------- | --------------------------------------- | ----------------------------------------------- |
| `ALL`          | Queryの結果をそのまま返す               | 全体と同じ                                      |
| `KEYS_ONLY`    | Queryの後にBatchGetItemで本体を取得する | ベーステーブルのキーとIndexのキーを逆算して返す |
| `INCLUDE`      | Queryの後にBatchGetItemで本体を取得する | 逆算したキーと射影された属性を返す              |

射影だけを返す場合の型は、itemのvariantごとの `Pick` である。

```ts
type ProjectedOf<T, K> = T extends unknown ? Pick<T, K & keyof T> : never;
```

素の `Pick<A | B, K>` は全variantに共通するキーしか取れないため、variantごとに適用する。これは公開Schemaの組み立てではなく、TypeScriptの型だけの操作である。

射影だけを返す場合は、各フィールドのSchemaによる検証だけを行う。object全体にかけた `superRefine` など、フィールドをまたぐ検証は実行できない。

本体をBatchGetItemで取得する場合は、次の点に注意する。

- 往復が2回になる。BatchGetItemは1回100件までで、未処理のキー（`UnprocessedKeys`）は再試行する
- 本体は強い整合性で読めるが、結果に含まれるItemはGSI（結果整合性）で決まる。取得したItemが条件に合わなくなっていたり削除されていたりする場合があるため、`matches` で再判定して除外する。その結果、1ページの件数が `limit` より少なくなることは許容する

### その他の方針

- Scanは公開しない
- 並べ替えはIndexのSort Keyと方向だけで表す
- キー以外の条件（FilterExpression）は、読み込んだ後に適用されて `limit` の意味がずれるため、許可しない
- 認可はクエリ名とパラメーターに対して行う（[認証と認可](../../zod-dynamodb/docs/shared-definitions.ja.md)）。取得後に結果を間引く方式はとらない

FirestoreのCollection Group Queryに相当するものは、パスの概念を持たないため、単にIndexを使う名前付きクエリとして表現する。

## 読み取るフィールドの指定

embeddingベクトルのような大きなフィールドを毎回返さなくて済むように、読み取りで返すフィールドを指定できるようにする。

```ts
await repository.tasks.get(key, { fields: { pick: ["title", "status"] } });
await repository.rows.get(key, { fields: { omit: ["embedding"] } });
```

- 指定方法は `pick`（返すフィールド）と `omit`（除外するフィールド）の2つとする
- キーのフィールドは常に返す。どちらを指定しても、結果が「どのItemか」を失わないようにするためである
- 結果の型は、itemのvariantごとの `Pick` / `Omit` とする（「名前付きクエリ」の射影の結果と同じく、TypeScriptの型だけの操作）
- 対象は、Get、名前付きクエリ、名前付きの検索、Subscription（Snapshotと変更イベント）とする。名前付きクエリと検索では、定義に既定の指定を持たせ、呼び出し時に上書きできるようにする

実装：

- DynamoDBの `ProjectionExpression` は返す属性を列挙する形式しかない。`omit` は、内部でitemのSchemaからフィールド名を集め、除外したものを列挙して `ProjectionExpression` に変換する。itemに `z.record()` などフィールド名を列挙できない部分がある場合は、全体を読んでからメモリ上で除外する
- `ProjectionExpression` を使っても、消費する読み取り容量はItem全体のサイズで決まる。削減できるのは、通信量、レスポンスのサイズ、リアルタイムのメッセージサイズ（[配送基盤](../../zod-dynamodb/docs/realtime.ja.md)）である
- 一部のフィールドだけを読む場合は、「名前付きクエリ」の射影と同じく各フィールドのSchemaによる検証だけを行い、フィールドをまたぐ検証は実行しない
- 更新処理（[書き込み](writes.ja.md)）で `ALL_OLD` として受け取るBeforeは、常にItem全体である

## Schema変更への対応

Schemaを変更すると、既存データが新しいSchemaでparseできない場合がある。名前付きクエリと検索の結果での扱いを、Repositoryのオプション（`invalidItems`）で選べるようにする。既定はエラーにする（`"throw"`）で、`"skip"` は結果から除外する。`get` は常にエラーにする。

キーとIndexのフィールドについては、次のように整理する。

- 物理キーはSchemaを使わずに逆算できる（[キーのエンコーディング](../../zod-dynamodb/docs/physical-layout.ja.md)）。キーのフィールドのSchemaの範囲指定などを変えても、エンコードは変わらず、既存のItemは読める
- 範囲を狭めた結果、範囲外になった既存の値は、逆算はできるがキーの検証や `item.parse` でエラーになる。キー以外のフィールドのSchemaを変えた場合と同じ扱いとする
- エンティティ名、キーやIndexのフィールドの構成、スロットの割り当てを変える場合は、データ移行が必要になる
- キーに使う整数の範囲は、余裕を持って指定することを勧める

## ページネーション

DynamoDBの `LastEvaluatedKey` は、そのままクライアントに返さない。

そのまま返すと、次の問題がある。

- 最後のItemのキー値（IndexのSort Keyを含む）がクライアントに渡る。フィールド単位で返さない値をIndexのキーにしていると、トークン経由で漏れる
- 物理的なキー構造が公開APIの一部になり、Indexを変更するとクライアントが保持するトークンが壊れる
- トークンとクエリの対応がないため、あるクエリのトークンを別のクエリに渡せてしまう

そこで、`{ クエリ名, キー条件のハッシュ, 開始キー }` を不透明なトークンとし、HMACで署名する。開始キーには物理キー（[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md)）が入るが、トークンの外には出ない。受け取ったトークンは、署名とクエリ・キー条件の一致を検証してから使う。キー値自体が機微な場合は暗号化も行う。

キー条件は、パラメーターと認証コンテキストから `where(params, ctx)` で計算した物理的な条件（Index、Partition Keyの値、Sort Keyの条件）である。パラメーターではなくキー条件に結び付けるので、同じパラメーターでも認証コンテキストが違えば（別のユーザーなど）トークンは使えない。
