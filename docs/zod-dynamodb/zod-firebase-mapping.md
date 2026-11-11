# zod-firebase → zod-dynamodb 対応表

- ステータス：zod-firebase から移るプロジェクトのための手引き（zod-firebase は zodapp から外した。最後の版はタグ `firebase-final`）
- 対象：`@zodapp/zod-firebase`（`packages/zod-firebase`, `zod-firebase-node`）の概念を `zod-dynamodb` でどう扱うか
- 関連：[design.md](./design.md)

---

# 1. 前提

`zod-firebase` は、Firestore の**階層パス**を、RDB のテーブルのようにフラットに扱うためのライブラリである。
パス関連の概念（`documentKey` / `collectionKeys` / `fieldKeys` / `nonPathKeys` / autoQuery など）は、
「パスをテーブルのキーに変換する」ために存在する。

DynamoDB は最初からテーブルなので、この変換層は不要になる。

- Collection 定義は **単一テーブル内の1エンティティ＝1定義** とし、Collection Path は持ち込まない
- キーは **Schema のフィールド名の並びで宣言する**（パスから導出しない）
- 親子関係はライブラリとして定義しない

一方で、zod-firebase の外から見た特徴のうち、次の2つは維持する。

1. データは、ID ではなく任意の数のフィールドで指定する
2. DB 固有の情報（zod-firebase では collection 名や documentId、zod-dynamodb では物理キーの属性名 `PK` / `SK` / `PK1`…、エンティティ名、`version`）を隠し、データを一つのオブジェクトとして読み書きする

> design.md §5「Table定義」はこの方針で記述している。

---

# 2. 定義例（案）

```ts
// 物理レイアウト。アプリで一度だけ定義する（design.md §5.5）
export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "PK1", sk: "SK1", projection: "ALL" },
    GSI2: { pk: "PK2", sk: "SK2", projection: "KEYS_ONLY" },
  },
});

export const tasks = tableConfig({
  table: appTable,
  entity: "Task",                                     // 物理キーの接頭辞
  item: taskKeyFields.and(taskBody).and(timestamps), // キーを含む。編集フォームにもそのまま使う
  create: taskBody,                                   // 作成フォームにそのまま使う
  key: { partition: ["workspaceId"], sort: ["taskId"] }, // item のフィールド名の並びで指定
  onCreate: ({ now }) => ({ createdAt: now, updatedAt: now }), // マージする値
  onWrite: ({ now }) => ({ updatedAt: now }),
  indexes: {
    byStatus: { slot: "GSI1", partition: ["workspaceId", "status"], sort: ["updatedAt"] },
  },
});
```

Schema は zod-form と兼用し、フォームにもそのまま使う。そのため、ライブラリは利用者が指定した Schema を組み替えずに返す（design.md §5.2）。

| 名前 | 種類 | 内容 |
|---|---|---|
| `item` | 公開 Schema（利用者が指定） | 保存されるデータ。キーを含む |
| `create` | 公開 Schema（利用者が指定） | 作成時の入力 |
| キーの型 | 公開する型 | `Pick<z.output<Item>, キーのフィールド>`（TS の型操作のみ） |
| 部分更新の型 | 公開する型 | item の variant ごとの `Partial`（TS の型操作のみ） |
| 射影の結果の型 | 公開する型 | item の variant ごとの `Pick`（TS の型操作のみ） |
| キーの検証 Schema / エンコーダー / 射影の検証 Schema | 内部専用（`ZodType<unknown>` など） | item から集めたフィールドの Schema から作る。外に出さないので差し引く操作も許す |

---

# 3. 概念の対応

## 3.1 パスと識別子

| zod-firebase | zod-dynamodb | 備考 |
|---|---|---|
| `path` | `entity` + `key.partition` / `key.sort`（item のフィールド名の並び） | パステンプレートは持たない。物理キーの文字列はライブラリが組み立てる（design.md §5.5 / §5.6） |
| collection 名 | `entity` | 物理キーの接頭辞として使い、読み取り結果には現れない |
| `documentKey` | （不要） | sort key（なければ partition key）がそれにあたるが、特別扱いしない |
| `collectionKeys` | （不要） | partition key がそれにあたる |
| `fieldKeys` / `nonPathKeys` / pathFieldKeys | **不要** | キーは最初から通常のフィールド。注入処理（`beforeGenerate` 内の fieldParams）も不要 |
| `documentIdentitySchema` | キーの型（公開）+ キーの検証 Schema（内部） | 公開するのは TS の型 `Pick<z.output<Item>, キーのフィールド>` だけ。実行時の検証 Schema は内部専用 |
| documentId（文字列） | 物理キー `PK` / `SK`（内部） | キーのフィールドを Schema から決まる方式でエンコードし、`#` で連結する。逆算もできる。利用者には見せない |
| `collectionIdentitySchema` | Query の `params`（名前付きクエリ単位） | テーブル共通の「コレクション識別子」はなくなり、使う index ごとに partition 条件が決まる |
| `buildDocumentPath` / `parseDocumentPath` | （内部）キーのエンコードと逆算 | 物理キーとの相互変換はライブラリ内部で行う。文字列表現が要る場面（Subscription キー、URL）は、アプリやプロトコル層が任意に決める |
| `resolveScopedQueryOptions`（autoQuery） | **不要** | DynamoDB の Query は partition key の等値条件が必須なので、範囲の限定は構造的に強制される |
| `checkNonPathKeys` | **不要** | |

## 3.2 Schema

| zod-firebase | zod-dynamodb | 備考 |
|---|---|---|
| `schema`（単一の Schema から全部を導出） | `item` と `create` を個別に指定 | 公開 Schema の導出をやめる。§5 |
| `dataSchema` | `item` | item 自体がキーを含むので、識別キーの付与は不要。`version` は返さない（加算はライブラリ内部、同期では同期プロトコルのメタ情報として扱う） |
| `createSchema` | `create` | 識別キーやサーバー管理フィールドを含めるかは利用者が決める。含めなければ hidden 化は不要 |
| `updateSchema`（編集フォーム・`setDoc` 用） | `item`（編集フォーム）+ 部分更新の型 | 編集フォームは item をそのまま使い、キーは `readOnlySchemaFields`（型を保つ）で読み取り専用にする。部分更新の値は、変更する各フィールドを item から取り出したフィールドの Schema で検証する |
| `storeSchema` | `item` + 物理キー（`PK` / `SK` / `PKn` / `SKn`）+ `_version` + 物理変換 | 保存形は item に物理キーとライブラリ管理属性を足したもの。読み取り時はこれらを取り除いてから `item.parse` する。日付などの変換は codec 層で行う（§3.6） |
| `createExcludedSchema` | `item` 側に intersection で足す | 例：`item: body.and(timestamps)`。値は `onCreate` / `onWrite` が返し、ライブラリがマージする。足りているかは「create の出力 & キー & onCreate の戻り値」が item に代入可能かで型検査する（引き算はしない） |
| hidden メタ（`hideSchemaFields`） | `readOnlySchemaFields` / `hideSchemaFields` をフォーム用に適用 | どちらも受け取った Schema と同じ型 `S` を返すので、公開 Schema の型を損なわない。ライブラリが `editSchema` として提供することも検討 |

## 3.3 ライフサイクルフック

| zod-firebase | zod-dynamodb | 備考 |
|---|---|---|
| `onInit` | 残す（フォーム用） | DB の意味は持たない。フォーム層に移す案もある |
| `onCreateId` | `generateKey` | 生成に必要な値（Partition Key など）を引数で受け取る。生成されるキーを除いた型は導出しない |
| `onCreate` / `onWrite` | 残す | zod-firebase と同じく**マージする値を返す**フック。マージと検証はライブラリが行う。**バックエンドの Repository でのみ実行する**（zod-firebase ではブラウザでも実行される）。`_version` はライブラリ本体が管理する |
| `onNotifyDelete` | 廃止 | 変更イベントをライブラリが作り、削除であることと書き込み元をイベントで伝えられるため不要。削除した人を残すなら runner で監査用の Item と一緒に書く |
| `onDelete`（論理削除） | 廃止 | 通常の名前付きミューテーションで書く。名前付きクエリからの除外は、Index のキーのフィールドを消す（sparse index）などアプリ側で行う |

## 3.4 クエリ・ミューテーション・参照

| zod-firebase | zod-dynamodb | 備考 |
|---|---|---|
| `createCollectionQueries`（`where` / `orderBy` の JSON） | 名前付きクエリ（宣言的） | `q({ index, params, where: (p) => ({ partition, sort }), select?, direction })`。sort は先頭から順に等値、続く1個に範囲。JS 上で評価できる形にして、Subscription の所属判定にも使う |
| （なし） | `select: "full" \| "projection"` | GSI のスロットの射影（`ALL` / `KEYS_ONLY` / `INCLUDE`）に応じて、射影だけを返すか、BatchGetItem で本体を取るかを選ぶ |
| `QueryOptions.orderBy` | index の sort key + 方向 | 任意フィールドでの並べ替えはできない |
| `where`（キー以外の条件） | FilterExpression（任意） | 読み込んだ後に適用されるので `limit` の意味がずれる。MVP では許可しない案もある |
| `createCollectionMutations`（Partial を返す関数） | 名前付きミューテーション（`params` + `patch(params) => 部分更新`） | 考え方はそのまま。`params` を Zod Schema にして、クライアント入力の検証と認可の単位にする。マージと検証はライブラリが行う |
| （なし。Firestore の `findNearest` は zod-firebase では未対応） | 名前付きの検索（ベクトル検索） | DynamoDB のベクトルインデックスを物理レイアウトのスロットとして扱う。embedding ベクトルは item の普通のフィールド。`HASH` は複合キーのエンコード、`INLINE_FILTER` は静的または動的な対応で文字列にエンコードする（design.md §6.6） |
| `createCollectionReference` | 残す | `valueField` の既定値は `documentKey` だったが、複合キーの場合の扱いを決める（partition は `contextId` 側で与える想定） |

## 3.5 アクセサ（-node）

| zod-firebase-node | zod-dynamodb-node | 備考 |
|---|---|---|
| `getDoc` | `get(key)` → item \| null | 一つのオブジェクトだけを返す。強い整合性の読み取りを選べるようにする（index からの読み取りは常に結果整合） |
| `createDoc` / `createDocWithId` | `create(key, input)` | `attribute_not_exists` による条件付き書き込み、`_version = 1` |
| `updateDoc` | `update(key, patch)` / ミューテーション | 変更するフィールドだけをフィールド単位で検証 → `UpdateItem`（SET / REMOVE、`ADD _version 1`、`where` 条件）→ `ALL_OLD` で Before を得て、After は JS で組み立てる（design.md §6.4） |
| `deleteDoc` | `delete(key)` | `where` 条件付きで削除し、`ALL_OLD` で Before を得る |
| `query` | `query.<name>(params, page)` | ページングは不透明なトークンで返す |
| `getDocSnapshot` / `querySnapshot` | （不要） | Snapshot オブジェクトはない。version などのメタ情報は同期プロトコルの内部で扱う |
| `docSync` / `querySync` / `querySnapshotSync` | Realtime 層 | Repository の責務から外す |
| `withContext({ runner: transaction })` / `withContext({ runner: batch })` | `runTransaction(fn)` / `createBatch()` と `withContext({ runner })` | 形はそのまま引き継ぐ。どちらも書き込みをためて1回の `TransactWriteItems` で確定する。transaction で読んだ Item は `_version` の `ConditionCheck` にし、変わっていれば `fn` をやり直す。`set` / `update` / `delete` の対象はライブラリが事前に読んで Before を得る。`where` 付きの書き込みと `check(key, where)` も使える。100件・4MB・同じ Item は1回まで（design.md §6.4） |
| `docToData` / `docToDataSafe` | `decode` / `decodeSafe` | Schema 変更で既存データが parse できない場合の扱い（エラー / 除外 / 生データで返す）を決める |

## 3.6 値の変換

| zod-firebase | zod-dynamodb | 備考 |
|---|---|---|
| `Timestamp` ↔ `Date` の変換 | codec 層 | DynamoDB に日付型はない。ISO 文字列または epoch。キーに使う `z.date()` は UTC の ISO 文字列にエンコードする（design.md §5.6） |
| — | キーのエンコーディング | 文字列（`$` 以下の文字をエスケープ）はそのまま、それ以外の型は `$` + 型識別子 + データ（`null`、boolean、数値は IEEE754 の順序保存形を16進数、日時は ISO 文字列）。Schema を使わずに逆算でき、union もキーにできる |
| `undefined` → `FieldValue.delete()`（merge） | 部分更新で `undefined` のフィールドを `REMOVE` | 差分で書き込むので、部分更新にないフィールドはそのまま残る |
| — | Set / 数値精度 / 空文字 | DynamoDB 固有の扱いを codec で吸収する。`zod-transform` / `zod-transport-json` の流用を検討 |

---

# 4. 型の基底インターフェース

zod-firebase の `CollectionConfigBase` / `LooseCollectionConfigBase` は、具体的な generics を知らないユーティリティのために、Schema を `z.ZodType<any>` / `any` で表している。

DynamoDB 版では、汎用ユーティリティの制約は「各 Schema がどの種類か」だけを表し、受け取った Schema の具体的な型は generics のまま流す。内部専用の Schema は `ZodType<unknown>` として持つ。

```ts
type AnyTable = {
  readonly table: PhysicalTable;
  readonly entity: string;
  readonly item: z.ZodType;
  readonly create: z.ZodType;
  readonly key: { readonly partition: readonly string[]; readonly sort?: readonly string[] };
  readonly indexes?: Record<string, { slot: string; partition: readonly string[]; sort?: readonly string[] }>;
};

type DocOf<T extends AnyTable> = z.output<T["item"]>;
```

---

# 5. Schema の扱い

## 5.1 zod-firebase の現状（意図した設計）

zod-firebase は、単一の Schema（union / discriminatedUnion / intersection も可）から、識別キーの付与・除外、`createExcludedSchema` の合成、hidden 化を行って用途別の Schema を導出している。

差し引く処理を汎用的に行うため、`mergeSchema`（`zod-form`）が `ZodTypeAny` を返し、それを `z.ZodType<DataTypeFor<...>>` に cast している。値の型（`z.infer`）は正しいが、各 Schema 固有の API は使えない。

## 5.2 DynamoDB 版の方針

**公開する Schema：利用者が指定し、そのまま返す**

1. `item`（キーを含む）と `create` は利用者が個別に指定する。create から item（またはその逆）を導出しない。
2. Schema は zod-form と兼用するので、ライブラリは公開 Schema を組み替えずに、そのままの型で返す。
3. 公開 Schema に対して exclude / omit のような差し引く操作はしない。partial Schema も導出しない。
4. 公開する型（読み取り結果、キー、部分更新）は、利用者の Schema の TS 型から作る（`z.output<Item>`、`Pick`、variant ごとの `Partial`）。

**内部専用の Schema：型は問わない**

実行時の検証のために内部で作る Schema は外に出さないので、`ZodType<unknown>` でよく、差し引く操作も許す。現時点で必要なのはキーの検証 Schema だけ。公開する型とは別々に作られるので、両者の一致はテストで確認する。

**データの変換：ライブラリが担う**

- 作成：`{ ...create の入力, ...onCreate(), ...onWrite(), ...key }` をマージし、`item` で検証
- 部分更新・ミューテーション：部分更新に `onWrite` を足し、変更する各フィールドをフィールドの Schema で検証。キーと `immutable` のフィールドの変更は拒否。`UpdateItem` で差分を書き込み（`undefined` は `REMOVE`）、`ALL_OLD` の Before に変更を適用して After を作る
- 書き込み：論理キーから物理キーを組み立てて付ける（更新時は変更したフィールドを使う Index の物理キーだけを付け直す）。`_version` は作成時に1、更新のたびに `ADD` で1増やす
- 読み取り：物理キーとライブラリ管理属性を取り除いてから `item.parse()` に通す（`z.strictObject` でも失敗しないように）。射影だけを返すクエリでは、物理キーからキーを逆算する
- DynamoDB の属性値との相互変換（codec）

partial Schema を導出せず、item の Schema を辿って変更するフィールドの Schema を取り出して検証するので、union / intersection を含む item の部分更新を検証できる。作成時はマージ後の全体を `item` で検証する。

（下の試作は、更新時もマージ後の全体を検証していた時点のものである。更新を差分の `UpdateItem` とする方針（design.md §6.4）に合わせた確認は、まだ行っていない。）

試作（TypeScript 5.9 / zod 4.4.3）で次を確認した。

- `item` に `object.and(discriminatedUnion).and(object)`、`create` に discriminatedUnion を指定でき、`tasks.create.options` / `tasks.item.def.right` などがそのまま使える
- `partition` / `sort` には item の全 variant に共通するフィールドだけを指定でき、一部の variant にしかないフィールドはコンパイルエラーになる
- キーの型 `Pick<z.output<Item>, PK | SK>` が得られ、読み取り結果にキーが含まれる
- 「create の出力 & キー & `onCreate` の戻り値」が item を満たさない（例：`updatedAt` を返し忘れる）とコンパイルエラーになる。引数側で検査すると戻り値の推論が壊れるため、`tableConfig` の戻り値の型で検査し、Repository に渡した時点でエラーにする
- `indexes` には、union の一部の variant にだけあるフィールドも指定できる（sparse index）
- 部分更新に存在しないフィールドを書くとコンパイルエラーになる
- 実行時、作成時のマージと、部分更新のマージ後の全体検証が期待どおり動く。variant を不正に切り替える部分更新、キーを変える部分更新、不正なキーは、いずれも拒否される

物理レイアウトとキーのエンコーディングについても、試作で次を確認した。

- キーにできない型（object）、`.optional()` のベーステーブルのキー、同じエンティティでのスロットの重複は、型と定義時の実行時検査の両方で拒否される。variant によってエンコード方式が異なるフィールドは定義時に拒否される
- 名前付きクエリで、Sort Key の先頭を飛ばした条件はコンパイルエラーになる
- クエリの結果は Index に載る variant だけに絞られる。`select: "projection"` の型は、`KEYS_ONLY` ではベーステーブルと Index のキーだけ、`INCLUDE` では射影された属性を加えたものになる
- 文字列のエスケープはランダムな値の組 20 万件で、範囲付き整数は範囲内の全値で、IEEE754 の方式は最大値・最小値・非正規化数を含む約 20 万件で、逆算と順序保存を確認した

## 5.3 トレードオフ

- `item` と `create` を両方書く必要があり、定義は少し長くなる。共通部分は変数に切り出して `.and()` で組み合わせる。
- `create` と `item` の対応は `onCreate` の型検査（代入可能性）でしか保証されない。検査の失敗は `tableConfig` の呼び出しではなく、Repository に渡した時点でエラーになる。
- 内部のキー検証 Schema と、公開するキーの型の一致は型では保証されず、テストで確認する。
- 更新時はフィールド単位で検証するため、object 全体にかけた `superRefine` のようなフィールドをまたぐ検証は、更新時には実行されない。
- 差分で書き込むため、同じ Item の別フィールドを同時に更新するリクエストは競合しない。同時更新を検出したい場合は `where` 条件などで表す。

---

# 6. 未決事項

- キーのエンコーディングの既定の挙動を変えたり、方式を利用者が独自に定義したりする仕組みを入れるか
- 推奨する物理レイアウト（スロットの本数と射影の組み合わせ）
- Schema の変更で既存データが parse できない場合の扱い
