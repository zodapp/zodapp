# Table定義

## 目的

Table定義は、フロントエンドとバックエンドの間で共有されるデータ契約である。次の2つを守る。

1. **データは、IDではなく任意の数のフィールドで指定する。** キーは複数のフィールドの組として指定できる。
2. **DB固有の情報を隠し、データを一つのオブジェクトとして読み書きする。** 物理キーの属性名（`PK` / `SK` / `PK1` など）、エンティティ名、`version` などのライブラリ管理属性は、読み取り結果にも書き込みの入力にも現れない。

Table定義は、少なくとも次の情報を表現する。

- 使用する物理テーブル（[物理レイアウト](physical-layout.ja.md)）
- エンティティ名
- 保存されるItemのSchema（item。キーのフィールドを含む）
- 作成時の入力Schema（create）
- キー（itemのフィールド名の並びで指定する Partition Key / Sort Key）
- 作成時・書き込み時にサーバーが付与する値（ライフサイクルフック。実装の側に置く。[共有の定義と、サーバーだけの上書き](shared-definitions.ja.md)）
- Indexの定義（使用するGSIのスロットとキーのフィールド）
- ベクトル検索の定義（使用するベクトルインデックスのスロット、`HASH` と `INLINE_FILTER` のフィールド。[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)）

名前付きの操作（Get、作成、ミューテーション、クエリ、検索など）は、Table定義とは別に `createOps` で定義する（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)、[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)、[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)）。公開する操作は[登録簿](shared-definitions.ja.md)に並べ、Subscriptionは登録簿でクエリに `live` を付けて公開する（[Subscription定義](realtime.ja.md)）。

Table定義と操作は、ブラウザとサーバーで共有する1つの定義として書き、ブラウザに出したくない規則だけをサーバーで上書きする（[共有の定義と、サーバーだけの上書き](shared-definitions.ja.md)）。

## 基本方針

`zod-dynamodb` では、**公開するSchema**、**内部専用のSchema**、**データの変換**を分けて考える。

### 公開するSchema：利用者が指定し、そのまま返す

このライブラリファミリーでは、Schemaを `zod-form` と兼用し、フォームにもそのまま使う。そのため、利用者が書いたSchemaをライブラリが組み替えずに、そのままの型で返すことを重視する。

1. **itemとcreateのSchemaは、利用者がそれぞれ指定する。** createからitemを導出したり、その逆をしたりしない。両者の対応付けは利用者に任せる。
2. **itemにはキーのフィールドを含める。** 編集フォームや表示でもキーを扱うためである。キーはitemのフィールド名で指定する。
3. **ライブラリはexclude / omitのような差し引く操作を公開Schemaに対して行わない。** 部分更新用のpartial Schemaも導出しない。
4. 公開する型（読み取り結果、キー、部分更新の入力、射影の結果）は、Schemaを組み立てて作るのではなく、利用者のSchemaのTypeScript型から作る（`z.output<Item>`、`Pick<z.output<Item>, キー>`、variantごとの `Partial` / `Pick` など）。

これにより、各Schemaには `ZodObject` に限らず、discriminatedUnion、intersection、unionなどを使える。受け取ったSchemaの型はそのまま残るため、`ZodDiscriminatedUnion` の `.options` や `ZodIntersection` の各辺など、それぞれのSchema固有のAPIを利用側でそのまま使える。

### 内部専用のSchema：型は問わない

実行時の検証や変換のためにライブラリが内部で作るSchemaや変換器は、外部に公開しない。そのため型は `ZodType<unknown>` でよく、必要であれば差し引く操作も内部では許す。

内部では次のものを作る。いずれも、itemのSchemaを辿って（object / intersection / union）該当フィールドのSchemaを集めて作る。

- **キーの検証Schema**：クライアントから送られたキー（Get / Delete などの引数）を検証する
- **キーのエンコーダー**：フィールドのSchemaから決まる、物理キーとの相互変換（[キーのエンコーディング](physical-layout.ja.md)）
- **射影の検証Schema**：射影だけを返すクエリ（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)）の結果を検証する
- **フィールドの検証Schema**：部分更新で変更する各フィールドを検証する（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）

内部のSchemaと公開する型は別々に作られるため、両者の一致は型では保証されない。一致はテストで確認する。

### データの変換：ライブラリが担う

- 作成時：キーの注入、createの入力とフックの戻り値のマージ
- 作成時の検証（マージした結果の全体を `item` で検証する）
- 更新時：変更するフィールドだけの差分更新（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）、フックの戻り値のマージ、フィールド単位の検証、キーと `immutable` のフィールドの変更の拒否、Afterの組み立て
- 物理キー・ライブラリ管理属性の付与と除去（[物理レイアウト](physical-layout.ja.md)）
- キーのエンコードと逆算（[キーのエンコーディング](physical-layout.ja.md)）
- DynamoDBの属性値との相互変換（[値の変換](physical-layout.ja.md)）

Schemaを差し引かずに部分更新を扱えるのは、**部分更新用のSchemaを作るのではなく、itemのSchemaを辿って変更するフィールドのSchemaを取り出し、フィールドごとに検証する**ためである。作成時は、マージした結果の全体を `item` で検証する。

## 定義例

```ts
// shared/tasks.ts（共有の定義。ブラウザでも動く）
import { z } from "zod";
import { physicalTable, tableConfig } from "@zodapp/zod-dynamodb";

// 物理レイアウト。アプリケーションで一度だけ定義する
export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "PK1", sk: "SK1", projection: "ALL" },
    GSI2: { pk: "PK2", sk: "SK2", projection: "KEYS_ONLY" },
    GSI3: { pk: "PK3", sk: "SK3", projection: { include: ["createdAt", "updatedAt"] } },
  },
});

const taskKeyFields = z.object({
  workspaceId: z.string(),
  taskId: z.string(),
});

const taskBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("todo"),
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    assignee: z.string().nullable(),
    priority: z.int().min(0).max(9),
  }),
  z.object({
    kind: z.literal("milestone"),
    title: z.string(),
    dueDate: z.date(),
  }),
]);

const timestamps = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const tasks = tableConfig({
  table: appTable,
  entity: "Task", // 物理キーの接頭辞。変更するとデータ移行が必要

  // 保存されるもの。キーのフィールドを含み、編集フォームにもそのまま使う
  item: taskKeyFields.and(taskBody).and(timestamps),

  // 作成フォームにそのまま使う。キーとタイムスタンプは含まない
  create: taskBody,

  // キーはitemのフィールド名の並びで指定する
  key: { partition: ["workspaceId"], sort: ["taskId"] },

  // 物理GSIのスロットを明示して割り当てる
  indexes: {
    byStatus: { slot: "GSI1", partition: ["workspaceId", "status"], sort: ["priority", "updatedAt", "taskId"] },
    byAssignee: { slot: "GSI2", partition: ["workspaceId", "assignee"], sort: ["updatedAt", "taskId"] },
    byDue: { slot: "GSI3", partition: ["workspaceId"], sort: ["dueDate", "taskId"] },
  },

  // ライフサイクルフック。マージする値を返す。マージと検証はライブラリが行う
  onCreate: ({ now }) => ({ createdAt: now, updatedAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});
```

`onCreate` / `onWrite` は、**マージする値を返すフック**である。フックはTable定義に書くが、呼ばれるのはサーバー（Repository）だけである（[共有の定義と、サーバーだけの上書き](shared-definitions.ja.md)）。

作成時のデータが `item` を満たすかどうかは、型で検査する。この検査は「`create` の出力型 & キーの型 & `onCreate` の戻り値の型」が「`item` の入力型」に代入可能かを見るだけで、Schemaの引き算は行わない。上の例で `updatedAt` を返し忘れると、コンパイルエラーになる。`create` と `item` がキー以外で同じであれば、`onCreate` は不要である。

`tableConfig()` の引数側でこの検査を行うと `onCreate` の戻り値の型推論が壊れるため、検査は `tableConfig()` の戻り値の型で行い、Repositoryに渡した時点でエラーにする。

キーとIndexのフィールドには、型と定義時の実行時検査で次の制約がある。

| 対象 | 型での検査 | 定義時の実行時検査 |
|---|---|---|
| `key.partition` / `key.sort` | itemの**全variantに共通する**フィールドで、値が `undefined` にならず、出力型がキーにできる型（[キーのエンコーディング](physical-layout.ja.md)）であること | Schemaがエンコードできる種類であること。`.optional()` でないこと |
| `indexes.*.partition` / `sort` | **いずれかのvariant**にあるフィールドで、出力型がキーにできる型であること | 同上 |
| `indexes.*.slot` | 物理レイアウトに存在するスロットであること。同じエンティティで同じスロットを二度使わないこと | 同上 |

unionの `keyof` は共通フィールドになるため、ベーステーブルのキーにはすべてのItemが持つフィールドしか指定できない。一部のvariantにしかないフィールドをIndexに指定すると、そのvariantのItemだけが載るsparse indexになる（[物理レイアウト](physical-layout.ja.md)）。

### 同順位の決め手（tie breaker）

Indexの `sort` が同じ値になるItemが並ぶと、DynamoDBはその中の順を決めない。主キーの順になるとも限らない。一方、ライブの一覧（[リアルタイムの同期](../../zod-dynamodb-client/docs/live-sync.ja.md)）は「Sort Key、同じなら主キー」の順で並べ、どこまで読んだかを判定する。順を一意に決めたいIndexでは、`sort` の末尾に主キーのフィールド（`partition` と `sort` にまだ入っていないもの）を書く。上の例の `taskId` がそれである。

Firestoreのようにライブラリが主キーを自動で付けることはしない。`sort` がすでに一意な値（ナチュラルキー）で終わっている場合にまで、Sort Keyを長くしないためである。付け忘れると、同じSort Keyのものがページの境界をまたいだとき、ライブの一覧で読み込んだ項目の一部が隠れる（「さらに読み込む」で現れる）。ライブの一覧で使うIndexには必ず書く。

### 変更しないフィールド（`immutable`）

キー以外のフィールドを、作成後に変更しないフィールドとして宣言できる。

```ts
immutable: ["ownerId"],
```

- 更新（部分更新、ミューテーション、`onWrite` の戻り値）でこのフィールドを変更しようとすると、エラーにする
- 値が変わらないため、書き込みの条件（`where`。[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）やIndexのキーに安全に使える。Indexのキーの付け直しで、先に読み取った値をそのまま使える（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）

**指針**：親子関係にあるエンティティで、親のフィールド（所属する組織など）を使って認可する場合は、子にも同じフィールドを `immutable` として持たせる。子の更新や削除の認可を、親を読み取らずに子の `where` だけで表せるようになる。

### 1つのエンティティに1つのTable定義

1つのエンティティに対するTable定義は1つだけとする。同じエンティティ名を持つ複数のTable定義は、Repositoryの作成時にエラーにする。

- アクセスの制限は定義ではなく、公開する操作と認可（[認証と認可](shared-definitions.ja.md)）と `where` で表すため、制限のない別の定義は要らない
- 読むフィールドを減らしたい場合（大きなフィールドを含まない一覧など）は、読み取るフィールドの指定（`fields` の `pick` / `omit`。[読み取るフィールドの指定](../../zod-dynamodb-node/docs/queries.ja.md)）か、Indexの射影（`KEYS_ONLY` / `INCLUDE`。[物理レイアウト](physical-layout.ja.md)）で対応する

## 各Schemaと型の役割

| 名前 | 種類 | 内容 | 主な用途 |
|---|---|---|---|
| `item` | 公開Schema（利用者が指定） | 保存されるデータ。キーを含む | 読み取り結果、作成時の全体検証、更新時のフィールド単位の検証、編集フォーム |
| `create` | 公開Schema（利用者が指定） | 作成時にクライアントが渡すデータ | 作成の入力、作成フォーム |
| キーの型 | 公開する型 | `Pick<z.output<Item>, キーのフィールド>` | Get / Update / Delete の引数 |
| 部分更新の型 | 公開する型 | itemのvariantごとの `Partial` | 部分更新の入力 |
| 射影の結果の型 | 公開する型 | itemのvariantごとの `Pick`（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)） | 射影だけを返すクエリの結果 |
| キーの検証Schema / エンコーダー / 射影の検証Schema | 内部専用（`ZodType<unknown>` など） | itemから集めたフィールドのSchemaから作る | 入力の検証、物理キーとの相互変換 |

### Schema の前提：出力をもう一度通しても通ること

ライブラリは、同じ値を何度か `parse` する。フックの値とキーを足した後に item の Schema で検証し、読み取りでは保存した値（item の Schema の出力）を item の Schema でもう一度検証して、壊れたデータを `CorruptedDataError` で見つける。そのため、`item`・`create`・操作の `params` の Schema は、**出力をもう一度同じ Schema に通しても通る**ものに限る。

- `transform`・`pipe`（`preprocess`・`codec` も中身は `pipe`）は、入力と出力の型が違うので使えない。定義時に `DefinitionError` にする（キーのフィールドだけでなく、すべてのフィールド）
- `default`・`prefault`・`catch`・`coerce`・`trim` などは、出力をもう一度通しても通るので使える。ただしキーのフィールドでは `default` も使えない（[キーのエンコーディング](physical-layout.ja.md)）
- 定義時に確かめるのは、object・union・intersection・optional・array などの Schema の木の中までで、`z.custom` などの中身は確かめられない
- 共有の定義の操作（`execute`、サーバーの API、router、Gateway）では、認可の前に 1 回だけ検証し、その結果を `authorize` と書き込みの両方に使う。`default(() => randomUUID())` のように毎回違う値を作る Schema でも、認可した値と保存する値は同じになる。Repository のアクセサーを直接呼ぶ場合は、アクセサーが検証する

### 読み取り結果

読み取り結果は `z.output<Item>` そのものであり、キーを含む。物理キーの属性やライブラリ管理属性は含まない。

```ts
const task = await repository.tasks.get({ workspaceId: "ws1", taskId: "task1" });
// task: z.output<typeof tasks.item> | null
```

`version` も読み取り結果には含めない。`version` の加算はライブラリが行い（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）、更新の条件は `version` ではなくフィールドに対する `where` で表すため、利用者が `version` を扱う場面はない。リアルタイム同期では `version` を使うが、これは同期プロトコルとクライアントライブラリの内部で扱う（[Item Version](../../zod-dynamodb-client/docs/live-sync.ja.md)）。

フォームで編集している間の他者による更新を検出したい場合は、`version` を直接見せずに、中身の見えないトークン（`ifUnchanged`）を使う（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）。

### フォームとの連携

- 作成フォームは `create` をそのまま使う
- 編集フォームは `item` をそのまま使う。キーのフィールドを読み取り専用にするには、`zod-form` の `readOnlySchemaFields` を使う。この関数は受け取ったSchemaと同じ型を返すので、公開Schemaの型を損なわない
- キーのフィールドに使う値の制約（[キーのエンコーディング](physical-layout.ja.md)）は長さの上限だけなので、通常は特別なSchemaは不要である
