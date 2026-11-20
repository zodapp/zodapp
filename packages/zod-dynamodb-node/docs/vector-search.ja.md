# ベクトル検索

[English](vector-search.md)

## ベクトル検索

DynamoDBのベクトルインデックス（`SearchVectors` API）を、名前付きクエリと同じ考え方で扱う。どのembeddingモデルを使うかはライブラリでは扱わず、アプリケーションが決める。

### DynamoDBのベクトルインデックスの前提

設計に関係する仕様は次のとおり。

- embeddingベクトルは、通常のItemの属性に数値のリスト（`L` of `N`）として持たせる。次元数（最大4096）と距離関数（`COSINE` / `DOT_PRODUCT` / `EUCLIDEAN`）はインデックスごとに固定で、作成後に変えられない
- ベクトル属性を持たないItemはインデックスに載らない（sparse）
- `SearchSchema` で、次の2種類の属性を指定できる。構成は作成後に変えられない
  - `HASH`（ベクトルインデックスのパーティションキー）：1インデックスに1属性。検索のたびに等値条件で値を指定する必要がある。Itemにこの属性がないとインデックスに載らない。型が合わないと書き込み自体が拒否される
  - `INLINE_FILTER`：1インデックスに最大18属性。現状は等値条件のみ。Itemにこの属性がなくてもインデックスに載る
- 射影は `ALL` / `KEYS_ONLY` / `INCLUDE` から選ぶ。`KEYS_ONLY` には、ベーステーブルの主キー、ベクトル、`HASH`、`INLINE_FILTER` の属性が含まれる
- `SearchVectors` は、類似度の順にItemと `Score` を返す。1回で返せるのは最大100件で、ページネーションはなく、結果整合性である。IAMのFGACは効かない
- テーブル単位の制約
  - ベクトルインデックスがあるテーブルは、テーブルごとオンデマンドの容量モードに限られる
  - ベクトルインデックスは標準で1テーブル5本まで（申請すれば20本まで）で、GSIの上限（20本）に含まれる
  - インデックスの作成と削除は、GSIと合わせてテーブルごとに1つずつしか行えない
  - ベーステーブルが600GBを超えると、インデックスの作成にAWSへの申請が必要になる

### 置き場所

**ベクトルインデックスは、既存の単一テーブルに載せることを標準とする。** ベクトルインデックスはsparseなので、ベクトル属性を持たない他のエンティティのItemは影響を受けない。

別の物理テーブルにするのは、次のような場合に限る。`physicalTable()` で抽象化しているため、どちらを選んでもAPIは変わらない。

- 本体のテーブルをプロビジョンドの容量モードで運用したい
- ベクトルインデックスを頻繁に作り直す予定がある（バックフィルの間、本体のGSIを変更できなくなるため）

### embeddingベクトルの持ち方

**embeddingベクトルは、itemの普通のフィールドとして持つ。** 呼び出し側がembeddingベクトルを作ってから、他のフィールドと同じように書き込む。作成・部分更新・ミューテーションのいずれも、通常の書き込みと同じ経路（[書き込み](writes.ja.md)）を通る。内容を変える場合は、呼び出し側が新しいembeddingベクトルも一緒に渡す。

書き込みの後でembeddingベクトルを非同期に作り、もう一度書き込む流れはとらない。書き込みが2回になり、ベクトルが古いままになる時間ができ、2回目の書き込みと他の更新とのversionの競合を避ける仕組みも必要になるなど、デメリットしかないためである。

ライブラリが行うのは、属性の対応付けと検証だけである。

- 書き込み時に、embeddingベクトルのフィールドの値を、スロットの属性名（下の `V1` など）に書き込む。読み取り時は元のフィールド名に戻す
- 次元数がスロットの設定と一致することを、書き込む前に検証する（DynamoDBは次元数が合わない書き込みを拒否するが、その前にわかりやすいエラーにする）

embeddingベクトルは数KB〜十数KBになるため、読み取り結果やリアルタイムのイベントからは、読み取るフィールドの指定（[読み取るフィールドの指定](queries.ja.md)）で除外する。

### ベクトルスロット

GSIと同じく、ベクトルインデックスの属性名（ベクトル、`HASH`、`INLINE_FILTER`）はインデックスごとに固定され、エンティティ間で共有される。そこで、ベクトルインデックスも物理レイアウトの「スロット」として定義する。

```ts
export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    /* GSI のスロット（[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md)） */
  },
  vectorIndexes: {
    VEC1: {
      vector: "V1",
      hash: "VH1",
      filters: ["VF1_01", "VF1_02", /* …, */ "VF1_18"],
      dimensions: 1536,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
    VEC2: {
      vector: "V2",
      hash: "VH2",
      filters: ["VF2_01", /* …, */ "VF2_18"],
      dimensions: 1024,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
  },
});
```

- **スロットは複数定義できる。** 各スロットは「次元数 × 距離関数」の組に対応する。何本用意するかはアプリケーションが決め、上限はDynamoDBのベクトルインデックスの本数の上限による
- **1つのスロットを、次元数と距離関数が同じ複数のモデルで共有してよい。** 異なるモデルのベクトルを比較しても意味はないが、検索は必ず1つの `HASH` の値の範囲で行われる。そのため、`HASH` の値ごとに使うモデルが1つに決まっていれば、異なるモデルのベクトルが同じ検索の中で比較されることはない
- `INLINE_FILTER` の属性は作成後に追加できないため、使う見込みのある数（最大18）を最初から定義しておく
- 属性の型は、`HASH` と `INLINE_FILTER` ともに文字列（`S`）とする（下記）

エンティティは、使うスロットを定義時に固定するか、実行時の設定で選ぶ。Itemには選んだスロットの属性だけを書き、他のスロットの属性は書かない。

### HASH

`HASH` は、GSIのPartition Keyに相当する。値は、Partition Keyと同じ形式（[物理レイアウト](../../zod-dynamodb/docs/physical-layout.ja.md) / [キーのエンコーディング](../../zod-dynamodb/docs/physical-layout.ja.md)）でエンコードした文字列とする。

```text
VH1 = <entity>#<f1>#<f2>…
例：Row#p1#ds1#v3        （projectId#dataSourceId#dataSourceVersionId）
```

- エンティティ名を先頭に付けるので、同じスロットを共有しても他のエンティティと混ざらない
- 複数のフィールドを連結でき、値が空になることもない（空文字列は `HASH` に書けない）
- フィールドが `undefined` のときは書かないという [キーのエンコーディング](../../zod-dynamodb/docs/physical-layout.ja.md) の規則が、「`HASH` の属性がないItemはインデックスに載らない」というDynamoDBの挙動とそのまま一致する
- ライブラリが常に文字列で書くため、型の不一致で書き込みが拒否される事故が起きない
- 検索は1つの `HASH` の値の範囲を超えない。この境界を、テナントやデータソースのバージョンのような、検索が決して越えない単位に合わせる
- 取りうる値の数は、少なめから中程度がよい。多すぎる（Itemごとに一意など）と近傍のItemがなく精度が落ち、少なすぎる（booleanなど）と負荷が一つの値に集中する

ベーステーブルの `PK` とは別の属性にする。`PK` はItemに近い粒度であることが多く、`HASH` に求められる粒度とは一致しないためである。

GSIのSort Keyに相当するものはない。結果は類似度の順に並ぶ。

### INLINE_FILTER

`INLINE_FILTER` は、等値条件だけの追加の絞り込みである。1つの属性に、1つまたは複数のフィールドを [キーのエンコーディング](../../zod-dynamodb/docs/physical-layout.ja.md) の方式でエンコードして連結した文字列を書く。

- 型の衝突を避けられる：属性名はエンティティ間で共有され、型は作成時に固定される。ライブラリが常に文字列で書けば、エンティティ間で型が衝突しない
- `null` も `$%` として等値条件で検索できる
- 構成するフィールドが1つでも `undefined` なら、その属性を書かない。そのItemは、その属性で絞り込んだ検索には一致せず、絞り込まない検索には現れる

フィルターとフィールドの対応は、次の2通りで指定できる。

**静的なフィルター**：定義時に、フィルターの属性とフィールドの対応を固定する。

```ts
filters: { VF1_01: ["status"], VF1_02: ["category", "brand"] }
```

**動的なフィルター**：フィルターの属性の意味を、実行時のデータとして持つ。例えば、データソースのバージョンごとに、ユーザーが絞り込みに使うフィールドの組み合わせを設定する。

```text
物理（インデックス作成時に固定）  VF1_01 … VF1_18（属性名・型 S は不変）
意味（データソースのバージョンごとにユーザーが設定）
  VF1_01 = [型番, カテゴリ]
  VF1_02 = [カテゴリ]
値（書き込み時にライブラリが組み立てる）
  VF1_01 = "A100#家電"
  VF1_02 = "家電"
```

- 対応の設定は、`HASH` の範囲（この例ではデータソースのバージョン）に属させる。Itemはその設定に従って書き込まれるので、設定を変えるなら新しい `HASH` の範囲（新しいバージョン）として書き込み直す
- 等値条件しか使えないため、`VF1_01 = 型番#カテゴリ` は両方の値を指定したときにしか一致しない。カテゴリだけで絞り込みたいなら、`VF1_02 = カテゴリ` を別に設定する。よく使う絞り込みの組み合わせ1つにつき1属性を使い、その上限が18である。複数の属性はANDで組み合わせられる
- **使用上の注意**：1つの属性には1つの値しか書けない。1つのItemを複数の値のどれでも絞り込めるようにしたい場合（タグの配列など）は、値ごとにItemを複製して書き込み、検索結果を元のItemのIDで重複除去する。複製した分だけ `topK` の枠を使う
- フィールドの型は、実行時に決まるSchemaから決める。`encode(schema, value)` は実行時に作ったZodのSchemaでも同じように動くため、静的な定義と同じ仕組みで処理できる
- スロットの属性名（`VF1_01` など）は型で検査できるが、その中身は実行時に決まるため静的には型付けしない。書き込み時と検索時の両方で、同じ設定から値を組み立てる補助関数を提供し、書き込んだ値と検索する値がずれないようにする

embeddingベクトルは意味の近さを見るのには向くが、型番のような文字列の完全一致には向かない。完全一致の条件は `INLINE_FILTER` で絞り込み、意味の近さはembeddingベクトルで見るという分担になる。

### Table定義

```ts
export const rows = tableConfig({
  table: appTable,
  entity: "Row",
  item: z.object({
    projectId: z.string(),
    dataSourceId: z.string(),
    dataSourceVersionId: z.string(),
    rowId: z.string(),
    modelNumber: z.string(),
    category: z.string(),
    embedding: z.array(z.number()),
    // ...
  }),
  create: /* ... */,
  key: { partition: ["projectId", "dataSourceId", "dataSourceVersionId"], sort: ["rowId"] },
  vectors: {
    // スロットの静的な割り当て。スロットを定義時に固定するなら slot: "VEC1" と書く
    content: { field: "embedding", partition: ["projectId", "dataSourceId", "dataSourceVersionId"] },
  },
});

// server/repository.ts（サーバーだけ）：実行時の設定でスロットとフィルターを選ぶ
const repository = createRepository({
  tables: { rows },
  vectors: {
    rows: {
      content: {
        slot: (_row, { vectorConfig }) => vectorConfig.slot,
        filters: (row, { vectorConfig }) => buildFilters(vectorConfig.filters, row),
      },
    },
  },
  resolveVectorConfig: ({ hash }) => loadVectorConfig(hash), // HASH の値から設定を引く
  dynamodb,
});
```

`slot` と `filters` の関数は、実行時の設定を使うサーバーの処理なので、`createRepository` の `vectors` に書く（[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）。共有のTable定義には、スロットの静的な割り当て（`field`、`partition`、静的なフィルター）だけを置く。スロットを定義時に固定しないベクトルに `vectors` の設定がなければ、Repositoryの作成時にエラーにする。

`vectorConfig` は実行時の設定（使うスロット、フィルターの対応、embeddingモデルなど）である。次のように扱う。

- 設定は、`HASH` の範囲を代表するItem（この例ではデータソースのバージョンのItem）に持たせる。保存場所はアプリケーションが決め、ライブラリには `HASH` のフィールドの値から設定を引く関数（`resolveVectorConfig`）として渡す
- **設定は `HASH` の範囲ごとに不変とする。** Itemはその設定に従って書き込まれているので、設定を変えるなら新しい範囲（新しいバージョン）として書き込み直す。`live` のように範囲が変わらない場合も、設定を変えるときは範囲内の全Itemを書き直す
- 不変なので、ライブラリは `HASH` の値をキーにして設定をキャッシュしてよい。書き込みと検索のたびに設定を読み直す必要はない。範囲を書き直す場合に備えて、キャッシュを明示的に無効にする手段を用意する

### 名前付きの検索

検索も、名前付きクエリ（[名前付きクエリ](queries.ja.md)）と同じく名前付きで宣言し、クライアントからは名前とパラメーターだけを指定できるようにする。

```ts
// shared/rows.ts（共有の定義）
export const rowOps = createOps(rows, (o) => ({
  similar: o.search({
    vector: "content",
    params: z.object({
      projectId: z.string(),
      dataSourceId: z.string(),
      dataSourceVersionId: z.string(),
      text: z.string(),
      filterValues: z.record(z.string(), z.string()).optional(),
    }),
    topK: 20,
    select: "full",
    authorize: (ctx, { params }) => ctx.projects.includes(params.projectId),
    // HASH を構成するフィールドの値
    partition: (p) => ({
      projectId: p.projectId,
      dataSourceId: p.dataSourceId,
      dataSourceVersionId: p.dataSourceVersionId,
    }),
    // vectorConfig は partition から引いた実行時の設定
    filters: (p, _ctx, { vectorConfig }) =>
      buildFilters(vectorConfig?.filters, p.filterValues ?? {}),
  }),
}));

// server/overrides.ts（サーバーだけ）：検索用の embedding ベクトルはアプリが作る
override(rowOps.similar, {
  queryVector: (p) => embed(p.text),
});

// 結果: { item, score }[]
```

- `queryVector` は外部のAPIを呼ぶことが多いため、共有の定義には書かず、サーバーの上書きで必ず与える。上書きがなければ、検索の実行時にエラー（`DefinitionError`）にする
- `partition` には `HASH` を構成するフィールドすべてに値を与える。`filters` は省略できる
- `partition` と `filters` を別の関数にするのは、`filters` が使う実行時の設定（`vectorConfig`）を、`partition` から作る `HASH` の値で引くためである。Repositoryは `partition` を呼び、設定を引いてから `filters` と `queryVector` を呼ぶ
- `filters` の値は、`buildFilters` で組み立てた文字列か、フィールドの値の組（例：`{ VF1_01: { status: "active" } }`）とする。値の組はライブラリがエンコードする。値が `undefined` の属性では絞り込まない
- `select` の意味は [名前付きクエリ](queries.ja.md) と同じである。`KEYS_ONLY` のスロットで `"full"` を指定すると、ベーステーブルの `PK` / `SK` からキーを逆算し、BatchGetItemで本体を取得する。`"projection"` では、逆算したキーと射影された属性を返す
- 結果の各要素は `{ item, score }` とする。`score` はItemのデータではなく検索結果に付くメタ情報なので、itemとは分けて返す。`score` の意味（小さいほど近いか、大きいほど近いか）は距離関数によって異なる
- ページネーションはなく、`topK` は100以下とする
- リアルタイムの購読は対象外とする。順位が他のItemの変更によって変わるため、[Subscription定義](../../zod-dynamodb/docs/realtime.ja.md)の `limit` 付き購読と同じ理由で、1件の更新前後を比べるだけでは判定できない
- 認可は、名前付きクエリと同じく検索名とパラメーターに対して行う（[認証と認可](../../zod-dynamodb/docs/shared-definitions.ja.md)）。`HASH` による絞り込みはIAMの境界にはならないが、バックエンドを経由するため問題にならない

### 一括での書き込み

データソースの取り込みのように、書き込んだ後は変わらないItemを大量に書き込む場合、Itemごとに条件付きで書き込む必要はない。BatchWriteItemで一括で書き込む経路を用意する。

- BatchWriteItemは条件付きの書き込みができない
- 書き込みの速度には、`HASH` の値1つあたりの上限（10MB/秒）がある
- 古い範囲（古いバージョンなど）の削除は、DynamoDBに一括削除がないためItemごとに行うか、TTLを使う。TTLで削除されたItemは、ベクトルインデックスからも削除される
- 新しい範囲に書き込み終えてから、検索が参照する範囲（「現在のバージョン」など）を切り替えれば、検索が書き込み途中のデータを見ることはない
- 一括での書き込みもリアルタイムの変更イベントの対象とする（[一括での書き込みとイベント](../../zod-dynamodb/docs/realtime.ja.md)）
