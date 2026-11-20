# 書き込み

[English](writes.md)

## 更新処理

### 方針

更新は、**変更するフィールドだけを `UpdateItem` で書き込み、更新前のItemを `ReturnValues: ALL_OLD` で受け取る**方式を原則とする。Itemを事前に読み取ってから全体を書き込むことはしない。

```text
UpdateItem
  Update:    SET / REMOVE（変更するフィールドと、付け直すIndexの物理キー）
             ADD _version 1
  Condition: attribute_exists(PK) AND（ミューテーションの where）
  Return:    ALL_OLD                  → Before
After = Before に同じ変更をJSで適用したもの
```

- **Before** は、`ALL_OLD` で返る更新前のItem全体である。書き込みと同じリクエストで得るため、読み取りから書き込みまでの間に他の更新が入る余地はない
- **After** は、Beforeに同じ変更（SET / REMOVE / ADD）をJS上で適用して作る。DynamoDBに書き込んだ結果と一致する
- 変更イベント（[変更イベントの生成](../../zod-dynamodb/docs/realtime.ja.md)）は、このBeforeとAfterから作る
- 他のフィールドは書き換えないため、別々のフィールドを同時に更新するリクエストは互いに影響しない

DynamoDBの書き込み容量は、`UpdateItem` でも更新前後の大きいほうのItemサイズで消費される。差分で書き込んでも容量は減らないが、増えることもない。

### 部分更新

部分更新の入力は、itemの各variantを型レベルで `Partial` にしたものとする。

```ts
type PatchOf<T> = T extends unknown
  ? { [K in keyof T]?: T[K] | undefined }
  : never;

// tasks の場合：
//   { workspaceId?, taskId?, kind?, title?, status?, createdAt?, updatedAt? }
// | { workspaceId?, taskId?, kind?, title?, dueDate?, createdAt?, updatedAt? }
```

これは型の補助であり、partial Schemaは導出しない。

- 変更はトップレベルのフィールド単位で行う。値があるフィールドは `SET`、値が `undefined` のフィールドは `REMOVE` とする。`onWrite` の戻り値も同じく変更に加える
- **検証はフィールド単位で行う。** 変更する各フィールドを、itemのSchemaから取り出したそのフィールドのSchemaで検証する。variantによってフィールドのSchemaが異なる場合は、[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md)の `INCLUDE` と同じく、判別用のフィールドが変更に含まれていればそのvariantのSchemaで、含まれていなければいずれかのvariantのSchemaを満たせば通す
- object全体にかけた `superRefine` のような、フィールドをまたぐ検証は更新時には行わない。作成時（全体を `item` で検証する）とは扱いが異なる
- キーは引数の値で指定する。部分更新にキーのフィールドが含まれ、その値が引数のキーと異なる場合はエラーにする（キーは変更できない）
- `immutable` のフィールド（[定義例](../../zod-dynamodb/docs/table-definition.ja.md)）を変更しようとした場合もエラーにする

ネストしたオブジェクトの一部だけを変える深いマージ（Firestoreの `merge: true`）は行わない。ネストしたオブジェクトのフィールドを変更すると、そのオブジェクト全体を置き換える。一部だけを変えたい場合は、読み取ってから全体を渡す。

### Indexの物理キーの付け直し

変更するフィールドがIndexのキー（ベクトルスロットの `HASH` / `INLINE_FILTER` を含む）に使われている場合は、同じ `UpdateItem` の中でそのIndexの物理キーを `SET` で付け直す。変更によってIndexのキーのフィールドが `undefined` になる場合は、物理キーを `REMOVE` してIndexから外す（[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md)のsparse index）。

物理キーを組み立てるには、そのIndexのキーを構成するフィールドすべての値が要る。

- 変更に含まれるフィールドと、ベーステーブルのキーのフィールドは、その場で値がわかる
- `immutable` のフィールドは、事前に読み取った値がその後も変わらないため、`version` の条件なしで先に読み取って使ってよい
- それ以外のフィールドが含まれる場合は、強い整合性で先に読み取り、`_version` の一致を条件にして書き込む。一致しなければ読み直して再試行する。足りない値がない更新は、これまでどおり1回の `UpdateItem` で済む
- 実行時の設定でスロットやフィルターを選ぶベクトル（[ベクトル検索](vector-search.ja.md)）は、どのフィールドを使うかが実行時に決まるため、そのItemの更新では常に同じ方法で先に読み取る

### 読まない経路と読む経路

更新は、書き込む内容が事前にわかるかどうかで、2つの経路に分かれる。どちらの経路にするかは、Table定義と変更するフィールドからライブラリが決める。

- **読まない経路**：書き込む内容が、変更の内容、ベーステーブルのキー、`immutable` のフィールドだけで決まる場合。上の方針どおり、1回の `UpdateItem` と `ALL_OLD` で書く
- **読む経路**：それ以外の場合。強い整合性で先に読み、Beforeから書き込む内容を決め、`_version` の一致を条件に書き込む。一致しなければ読み直して再試行する

読む経路になるのは、次の場合である。

- Indexのキーの一部だけが変わり、残りのフィールドの値が必要な場合（上記）
- 判別用のフィールドを変えて、variantを切り替える場合。前のvariantにしかないフィールドと、新しいvariantでは載らないIndexの物理キーを `REMOVE` する。新しいvariantで必須のフィールドが変更に含まれていない場合はエラーにする

どちらの経路でも、BeforeとAfterは正確であり、`where` 条件もそのまま使える。

値から作る検索用のエンティティ（[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md)）は、ライブラリが自動では保たない。元のItemと一緒に書き換える必要がある場合は、アプリケーションがrunnerのtransaction（下記）で書く。

### 名前付きミューテーション

パラメーターから部分更新を作る関数を、名前付きで宣言する。

```ts
// shared/tasks.ts（共有の定義）
export const taskOps = createOps(tasks, (o) => ({
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    patch: (p) => ({ status: p.status }),
  }),
  rename: o.mutation({
    params: z.object({ title: z.string() }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    patch: (p) => ({ title: p.title }),
    // 担当者だけが変更できる
    where: (_p, ctx) => ({ assignee: ctx.userId }),
  }),
  bumpPriority: o.mutation({
    params: z.object({ delta: z.int() }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    add: (p) => ({ priority: p.delta }),
    where: (p) => ({ priority: { between: [0, 9 - p.delta] } }),
  }),
}));
```

`patch` と `where` は、ブラウザに出したくない場合やサーバー専用のモジュールを使う場合に、サーバーで上書きできる（[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）。上書きの `patch` / `where` は非同期でもよい。

ミューテーションの戻り値（部分更新）の検証と書き込みは、部分更新と同じくライブラリが行う。

クライアントに公開する更新は、原則として名前付きミューテーションとする（[サーバーの API](server-api.ja.md)）。`params` は編集フォームのSchemaとしても使える。更新してよいフィールドは、ミューテーションが書き込むフィールドによって決まる。

### 原子的な加算

名前付きミューテーションは、`patch` に加えて、数値のフィールドへの加算（`add`）を返せる。`UpdateItem` の `ADD` に変換し、読み取らずに原子的に加算する。

- Afterの値は、Beforeの値に加算量を足して作る
- 対象は、どのIndexのキー（ベクトルスロットの属性を含む）にも使われていないフィールドに限る。Indexのキーは書き込む前に値を確定させる必要があるためである。`add` は値を返す関数で、対象のフィールドは呼び出すまでわからないため、この制約はミューテーションの実行時に検査する
- 加算後の値はフィールドのSchemaで事前に検証できない。範囲を保つ必要がある場合は、`where` で加算前の値に条件を付ける

### `where` 条件

名前付きミューテーションと削除には、書き込みの条件（`where`）を付けられる。条件は `ConditionExpression` に変換し、書き込みと同じリクエストでDynamoDBが評価する。

- 比較する値は、フィールドのcodec（[値の変換](../../zod-dynamodb/docs/physical-layout.ja.md)）で変換する。Indexのキーのフィールドに対する条件も、保存されている属性の値に対して評価する
- 使える演算は、等値・比較（`eq` / `ne` / `gt` / `gte` / `lt` / `lte`）、`between`、`in`、`exists` / `notExists`、`beginsWith`、`contains`、`size` とする。いずれも `ConditionExpression` の範囲であり、フィールド同士の算術や正規表現は使えない
- 条件が成り立たない場合は書き込まず、エラーにする。`ReturnValuesOnConditionCheckFailure: ALL_OLD` で、Itemが存在しないのか、条件が成り立たないのかを区別する

更新前の状態を使う認可（「担当者だけが変更できる」「完了したものは変更できない」など）は、この `where` で表す（[認証と認可](../../zod-dynamodb/docs/shared-definitions.ja.md)）。判定と書き込みが一つのリクエストで行われるため、判定の後で状態が変わる競合は起きない。

`where` は、パラメーターと認証コンテキストを受け取る関数とする（削除の `where` は、パラメーターが空のオブジェクトで、`where: (_p, ctx) => ...` と書く）。静的な条件は、引数を使わない関数として書く。

Repositoryは、Itemが存在しない場合（`ItemNotFoundError`）と、条件が成り立たない場合（`ConditionFailedError`）を区別して返す。HTTPでは、Itemの存在を認可されていないクライアントに教えないため、両者を区別せずに同じエラーとして返す。エラーのメッセージには、「Itemが存在しないか、条件を満たしていない」と両方の可能性を示す（[エラー](../../zod-dynamodb/docs/protocol.ja.md)）。

### `version`

`version` はライブラリ管理属性 `_version` として保存し、読み取り結果には含めない（[各Schemaと型の役割](../../zod-dynamodb/docs/table-definition.ja.md)）。更新のたびに `ADD _version 1` で1ずつ増やす。リアルタイム同期は、この値でイベントの新旧を判断する（[Item Version](../../zod-dynamodb-client/docs/live-sync.ja.md)）。

更新に `_version` の条件は既定では付けない。差分更新では、別々のフィールドへの同時更新は競合しない。同じフィールドへの同時更新は後勝ちとなる。読む経路（上記）では、ライブラリが内部で `_version` の条件を付ける。

### 編集中の他者の更新の検出（`ifUnchanged`）

ライブラリが読んですぐに書く場合、その間の変更は差分更新で壊れない。`_version` の条件に意味があるのは、クライアントが読んだ時点と比べる場合だけである。そのため、`version` を直接見せずに、中身の見えないトークンを使う。

```ts
const { item, token } = await repository.tasks.get(key, { withToken: true });
// …フォームで編集…
await repository.tasks.mutate(taskOps.rename, key, params, {
  ifUnchanged: token,
});
```

- トークンには `version` を入れ、カーソル（[ページネーション](queries.ja.md)）と同じくHMACで署名する
- `ifUnchanged` を渡した書き込みは、`_version` の一致を条件にする。一致しなければ専用のエラーを返し、画面で「他の人が更新しました」と示せるようにする
- トークンを必須にする設定を、細かい単位ほど優先して置ける。`"required"` の場合、トークンのない書き込みはエラーにする

```ts
tableConfig({ ..., ifUnchanged: "required" })   // テーブルの既定。指定しなければ "optional"
o.mutation({ ..., ifUnchanged: "required" })   // ミューテーションごと
```

### 全体置換（`set`）

Item全体を新しい値で置き換える `set(key, input)` を、runnerの中と、通常のアクセサの両方で提供する。通常のアクセサの `set` は、1件だけのrunnerとして実装する（強い整合性で読み、`_version` の一致を条件に `Put` する）。

`set` をクライアントに公開するかどうかは、ほかの操作と同じくアプリケーションが決める（[サーバーの API](server-api.ja.md)）。ライブラリは、公開する操作を制限しない。

### 使用上の注意：ネストしたオブジェクトのフィールドへの加算

`ADD` や `SET a.b = a.b + :n` のように、ネストしたオブジェクトの中のフィールドを更新するには、親のオブジェクトがItemに存在している必要がある。存在しない場合、DynamoDBは書き込みを拒否する。

- 加算するカウンターは、トップレベルのフィールドとして持つことを勧める。トップレベルのフィールドは、存在しなくても `ADD` で0から加算される
- ネストした位置に置く場合は、作成時に親のオブジェクトを作っておく

### トランザクション

DynamoDBには、読み取りと書き込みを一つにまとめる対話型のトランザクションがない。また、`TransactWriteItems` は `ALL_OLD` を返さない。

アクセサを `withContext({ runner })` で実行単位（runner）に結び付け、同じアクセサの形で次の2種類を扱う。どちらも、書き込みをためておき、最後に1回の `TransactWriteItems` として原子的に確定する。

```ts
// 読み取りと書き込み（Firestore の transaction に相当）
await repository.runTransaction(async (tx) => {
  const parent = await repository.parents
    .withContext({ runner: tx })
    .get(parentKey);
  await repository.versions
    .withContext({ runner: tx })
    .create(versionKey, input);
  await repository.parents
    .withContext({ runner: tx })
    .update(parentKey, { latest: versionId });
});

// 書き込みだけ（Firestore の batch に相当）
const batch = repository.createBatch();
await repository.rows.withContext({ runner: batch }).set(rowKey, row);
await repository.rowIndexes.withContext({ runner: batch }).delete(oldIndexKey);
await batch.commit();
```

runnerに結び付けたアクセサで使える操作と、`TransactWriteItems` への変換は次のとおり。

| 操作                                    | 変換                                           | Before         |
| --------------------------------------- | ---------------------------------------------- | -------------- |
| `create(key, input)`                    | Put（`attribute_not_exists`）                  | なし（`null`） |
| `set(key, input)`                       | Put（置換）。全体を `item` で検証する          | 事前に読む     |
| `update(key, patch)` / ミューテーション | Update（「書き込み」の差分更新）               | 事前に読む     |
| `delete(key)`                           | Delete                                         | 事前に読む     |
| `check(key, where)`                     | ConditionCheck。書き込まない                   | 読まない       |
| `get(key)`（transactionのみ）           | 書き込まないItemはConditionCheck（`_version`） | 読んだ内容     |

- **Before / After**：`set` / `update` / `delete` の対象は、ライブラリが強い整合性で事前に読み、その `_version` を条件に付ける。変更イベントのBeforeはこの読み取り結果、AfterはそれにJS上で変更を適用したもの（`set` では書き込む内容そのもの）とする。`create` はItemが存在しないことを条件にするので、Beforeは `null` である
- **transactionの読み取り**：`runTransaction` の中で `get` したItemはすべて記録する。書き込んだItemには `_version` の条件を付け、読んだだけのItemは `ConditionCheck`（`_version` の一致）にする。どれかの条件が成り立たなければ、`fn` を最初からやり直す。「読んだものが変わっていればやり直す」という、Firestoreのtransactionと同じ意味になる。読み取りは書き込みより前に行う
- **batch**：利用者は読み取りを行わないが、ライブラリが内部で事前に読むため、他の更新と競合することがある。その場合はライブラリが読み直して再試行する。Firestoreのbatchは競合で失敗しないので、利用者から見える挙動は同じになる
- **条件付き更新**：runnerの中でも、`update` / ミューテーション / `delete` に `where`（「書き込み」）を付けられる。各操作の `ConditionExpression` に、`_version` の条件と合わせて入れる。読み取った値で判断する必要がなく、状態だけで判定できる場合は、読み取りを使わずに `where` で表すほうが往復も再試行も少ない
- **`check`**：書き込まないItemに条件だけを付ける。Itemを読まずに `ConditionCheck` にするので、「ある設定が一致していること」のような前提を、読み取りの往復なしで原子的に確かめられる
- **失敗**：`where` / `check` の条件が成り立たない場合は、再試行せずにエラーにする。`_version` の不一致による失敗だけを再試行の対象とし、回数の上限はオプションとする。どの条件で失敗したかは、`CancellationReasons` から区別する

DynamoDBの制約から、次の制限がある。

- 1回の確定で扱えるのは、読んだだけのItem（`ConditionCheck`）と `check` を含めて100件、合計4MBまで
- 同じItemを、1回の確定の中で2回以上操作できない。ライブラリは同じキーへの操作を検出してエラーにする
- transactionの中でクエリを使った場合、返ったItemの変更は `ConditionCheck` で検出できるが、条件に合うItemが新しく増えたこと（phantom）は検出できない
- 変更イベントの書き込み元（[一括での書き込みとイベント](../../zod-dynamodb/docs/realtime.ja.md)）は、どちらのrunnerでも `kind: "transaction"` とし、1回の確定で共通のIDを付ける

### 作成と削除

- 作成：`{ ...createの入力, ...onCreate(...), ...onWrite(...), ...key }` をライブラリがマージし、`item` で全体を検証する。物理キーを付け、`attribute_not_exists` による条件付き書き込み（PutItem）とし、`_version = 1` を設定する。Afterは書き込んだ内容そのものである
- 削除：`DeleteItem` に `where` の条件を付け、`ReturnValues: ALL_OLD` でBeforeを得る。Beforeは `REMOVED` イベントの生成に使う
- `delete` は常に物理削除する。削除用のフック（削除の通知や、論理削除への置き換え）は持たない

### 使用上の注意：論理削除と、削除した人の記録

論理削除は、ライブラリの機能ではなく、通常の名前付きミューテーションとして書く（`deletedAt` / `deletedBy` を書き込むなど）。

- 名前付きクエリから論理削除済みのItemを除外するには、そのミューテーションでIndexのキーに使うフィールドを消すなどして、Indexに載らないようにする（sparse index。[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md)）。購読の条件から外れるので、リアルタイム配信では `REMOVED` が届く（[目的](../../zod-dynamodb/docs/realtime.ja.md)）
- 物理的に消す必要があれば、論理削除の後でTTLなどで消す
- 削除を呼ぶ側は、エンティティごとに `delete` と論理削除のミューテーションを呼び分ける

`onNotifyDelete` は、Firestoreで削除の直前に印や更新者を書き、onSnapshotやトリガーで「削除であること」「誰が削除したか」を伝えるためのものだった。このライブラリでは変更イベントをライブラリが作り（[変更イベントの生成](../../zod-dynamodb/docs/realtime.ja.md)）、Afterがないことで削除がわかり、書き込み元の情報もイベントに載せられるため不要である。DynamoDB Streamsでも削除は `REMOVE` として届く。削除した人を永続的に残したい場合は、runnerで `delete` と監査用のItemの `create` を1回の確定にまとめる（「書き込み」）。
