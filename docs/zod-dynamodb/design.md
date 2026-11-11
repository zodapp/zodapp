# zod-dynamodb 設計書

**Zodベースの型安全なDynamoDBアクセス・リアルタイム同期ライブラリ群**

- ステータス：設計検討版
- 配置候補：`zodapp` モノレポ
- パッケージ命名方針：`@zodapp/zod-dynamodb-*`
- 対象：TypeScript / Zod / Amazon DynamoDB
- 関連プロジェクト：`@zodapp/zod-firebase`
- 関連文書：[zod-firebase → zod-dynamodb 対応表](./zod-firebase-mapping.md)

---

# 1. 概要

## 1.1 プロジェクトの目的

`zod-dynamodb` は、Zodで定義したTable定義を基点に、DynamoDBを型安全に利用するためのライブラリ群である。

単なるDynamoDB SDKのラッパーではなく、以下の領域を一貫して扱うことを目指す。

- データモデルとTable定義
- キーとIdentityの型安全な操作
- バックエンドからのCRUD・Query
- フロントエンドとバックエンドの通信契約
- ExpressなどのWebフレームワークへの組み込み
- リアルタイム変更通知と購読
- DynamoDBのテーブルやインデックスのインフラ定義

基本方針は、**フロントエンドからDynamoDBへ直接アクセスさせず、WAFで保護可能なバックエンドAPIを標準経路とすること**である。

また、既存プロジェクトの `zod-firebase` と設計思想を共有し、`zodapp` モノレポ内で継続的に発展させることを想定する。

## 1.2 設計原則

1. **Zodを定義の中心とする**  
   Table、データ構造、キー、操作時の入力検証などを、一貫した定義から導出する。

2. **フロントエンドとバックエンドで定義を共有する**  
   定義に基づいて、それぞれの環境に適した型付きオブジェクトを実行時に構築する。

3. **バックエンド経由のアクセスを標準とする**  
   データベース用の認証情報やIAM権限をフロントエンドに提供しない。

4. **多重防御を前提とする**  
   WAF、認証、認可、入力検証、IAMを、それぞれ独立した防御層として利用する。

5. **特定のWebフレームワークに中核機能を依存させない**  
   Expressには専用アダプターを提供するが、Repositoryや通信契約はExpressに依存しない。

6. **リアルタイム配信基盤を固定しない**  
   MQTTやAppSync Eventsなどを候補とし、通信プロトコルと配送実装を分離する。

7. **DynamoDBの制約を隠しすぎない**  
   インデックス、クエリ、一貫性、条件付き更新、トランザクションなど、DynamoDB固有の意味を保持する。

8. **コード生成を必須としない**  
   TypeScriptとZodの定義から、型付きAPIやラッパーオブジェクトを実行時に構築する。生成ファイルを前提とした設計にはしない。

9. **公開する操作は明示的に列挙する**  
   Table定義を渡しただけでCRUD一式が公開される形にはしない。公開する操作はアプリケーションが名前付きで列挙し、それぞれに認可を必須とする。

10. **DB固有の情報を隠し、データを一つのオブジェクトとして扱う**  
   データは任意の数のフィールドで指定し、物理キーの属性名、エンティティ名、`version` などのライブラリ管理属性を利用者に見せない。原則7とは、DynamoDBの操作の意味は隠さず、物理的な表現は隠すという関係にある。

---

# 2. プロジェクトの位置づけ

## 2.1 zodappモノレポへの配置

新しい独立モノレポや独立ブランドを立ち上げるのではなく、既存の `zodapp` モノレポに `zod-dynamodb-*` パッケージ群を置く。

当初は zod-firebase と並べる想定だったが、zod-firebase は zodapp から外し、zodapp のデータベースの層は zod-dynamodb に一本化した（zod-firebase の最後の版はタグ `firebase-final`）。

想定構成は以下のとおり。

```text
zodapp/
  packages/
    zod-dynamodb/
    zod-dynamodb-node/
    zod-dynamodb-client/
    zod-dynamodb-express/
    zod-dynamodb-cdk/
    zod-dynamodb-mqtt/
    zod-dynamodb-appsync/
```

上記は将来的なパッケージ構成案であり、すべてをMVPで作成する意味ではない。

パッケージの分割は、依存関係、実行環境、公開APIの安定性を基準に判断する。

名称の経緯（Burmaculex）は付録Aに記す。

---

# 3. システムアーキテクチャ

## 3.1 基本構成

標準的なデータアクセス経路は次のとおりとする。

```text
┌────────────────────────────┐
│ Frontend                   │
│                            │
│ zod-dynamodb-client        │
│ Shared Table Config        │
└─────────────┬──────────────┘
              │
              │ HTTPS
              ▼
┌────────────────────────────┐
│ WAF                        │
│                            │
│ Rate Limit / Filtering     │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Application Backend        │
│                            │
│ Authentication             │
│ Authorization              │
│ Express Middleware         │
│ Realtime Gateway           │
│ Protocol Handler           │
│ zod-dynamodb-node          │
└─────────────┬──────────────┘
              │
              │ AWS SDK / IAM
              ▼
┌────────────────────────────┐
│ DynamoDB                   │
└────────────────────────────┘
```

アプリケーションは、認証、認可、WAF、デプロイ構成を管理する。

ライブラリは、型安全なデータアクセス、通信プロトコルの処理、入力検証、Repository操作などを担当する。

## 3.2 WAFを利用する理由

WAFはすべてのセキュリティ問題を解決するものではないが、多重防御の一層として利用する。

具体的には、次の目的を持つ。

- 不正なHTTPリクエストのフィルタリング
- 一定の攻撃パターンに対する防御
- レート制限
- APIの公開入口の集約
- アプリケーション側の認証・認可と組み合わせた防御

WAFの導入を理由として、認証や認可を省略することはしない。

また、WAFを経由する設計にするためには、単にWAFを配置するだけでなく、**WAFを迂回してバックエンドのオリジンへ直接アクセスできない構成**を検討する必要がある。

## 3.3 DynamoDBへの直接アクセスを禁止する

フロントエンドにDynamoDBへのIAMアクセス権限を付与しない。

DynamoDBに対する操作は、原則としてバックエンドがIAM権限を利用して行う。

これにより、以下をバックエンドに集約できる。

- 利用者認証結果に基づくアクセス判断
- ドキュメント単位の認可
- 許可されるクエリの制限
- 更新可能なフィールドの制限
- 監査ログなどのアプリケーション固有処理
- APIレベルのレート制限や追加検証

---

# 4. zod-firebaseとの関係

## 4.1 共通する設計思想と相違点

既存の `@zodapp/zod-firebase` は、Zodを中心としたCollection定義から、型安全なデータ操作に必要な情報を導出する。

`zod-dynamodb` が継承するのは、次の考え方である。

- 単一の定義から、用途別のSchema（読み取り、作成、更新）を導出する
- ブラウザとサーバーで共有できる定義を持つ
- ライフサイクルフック（`onCreate` / `onWrite`）
- 名前付きクエリ・名前付きミューテーション
- 環境ごとに分かれた実装パッケージ
- 外から見た特徴として、データをIDではなく任意の数のフィールドで指定すること、DB固有の情報（collection名やdocumentId）を隠して一つのオブジェクトとして読み書きすること（§5.1）

一方で、`zod-firebase` は **Firestoreの階層パスを、RDBのテーブルのようにフラットに扱う** ためのライブラリである。`documentKey` / `collectionKeys` / `fieldKeys` / `nonPathKeys` / autoQuery といったパス関連の概念は、パスをテーブルのキーに変換するために存在する。

DynamoDBは最初からテーブルなので、この変換層は持ち込まない。Collection Pathや親子関係はライブラリとして定義しない。単一テーブルに複数のエンティティを置く場合も、エンティティごとにフラットに扱い、複数のエンティティをまとめて取得する使い方（item collection）は扱わない（§5.5）。

また、`zod-firebase` は単一のSchemaから用途別のSchemaを組み立てる（識別キーの付与・除外、hidden化など）。差し引く処理を汎用的に行うため、導出結果は `ZodType<T>` として扱われ、各Schema固有のAPIは使えなくなる。これは意図した設計だが、`zod-dynamodb` ではこの組み立てを持ち込まない。itemとcreateのSchemaは利用者が個別に指定し、フォームにもそのまま使えるよう、ライブラリは公開Schemaを組み替えずに返す。excludeのような差し引く操作は、外部に出さない内部のSchemaでのみ行う。一方、キーの注入やマージ、検証といったデータの変換はライブラリが担う（§5.2）。

概念ごとの対応は [zod-firebase → zod-dynamodb 対応表](./zod-firebase-mapping.md) にまとめる。

## 4.2 Firebaseのバックエンドサーバー構想

`zod-firebase` についても、将来的にバックエンドサーバーを介した利用を想定する。

目標とする経路は以下のとおり。

```text
Frontend
   │
   ▼
WAF
   │
   ▼
Backend
   │
   ▼
Firebase Admin SDK
   │
   ▼
Firestore
```

Firestore Security Rulesは原則としてすべて拒否し、フロントエンドSDKからの直接アクセスを認めない構成を想定する。

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

バックエンドは、Firebase Admin SDKなどを利用してIAM権限でFirestoreへアクセスする。

Admin SDKによるアクセスはFirestore Security Rulesの判定を受けないため、この構成が成立する。

なお、Rulesの全拒否はIAM権限を持つサービスからのアクセスを禁止するものではない。IAM権限の管理は別途必要となる。

## 4.3 両ライブラリの共通化方針

将来的には、以下の要素を共有できる可能性がある。

- HTTP通信プロトコル
- 共通エラー形式
- フロントエンド向けクライアントの基本構造
- Express Adapterの基本構造
- 認証コンテキストの取り扱い
- 名前付き操作と認可の枠組み

ただし、最初から独立した共通フレームワークを作ることは目的としない。

FirestoreとDynamoDBの実装経験を通じて、意味が一致する部分だけを段階的に共通化する。

---

# 5. Table定義

## 5.1 目的

Table定義は、フロントエンドとバックエンドの間で共有されるデータ契約である。

`zod-firebase` の外から見た特徴のうち、次の2つを維持する。

1. **データは、IDではなく任意の数のフィールドで指定する。** キーは複数のフィールドの組として指定できる。
2. **DB固有の情報を隠し、データを一つのオブジェクトとして読み書きする。** `zod-firebase` がcollection名やdocumentIdを隠すのと同じく、物理キーの属性名（`PK` / `SK` / `PK1` など）、エンティティ名、`version` などのライブラリ管理属性は、読み取り結果にも書き込みの入力にも現れない。

Table定義は、少なくとも次の情報を表現する。

- 使用する物理テーブル（物理レイアウト。§5.5）
- エンティティ名
- 保存されるItemのSchema（item。キーのフィールドを含む）
- 作成時の入力Schema（create）
- キー（itemのフィールド名の並びで指定する Partition Key / Sort Key）
- 作成時・書き込み時にサーバーが付与する値（ライフサイクルフック。実装の側に置く。§5.8）
- Indexの定義（使用するGSIのスロットとキーのフィールド）
- ベクトル検索の定義（使用するベクトルインデックスのスロット、`HASH` と `INLINE_FILTER` のフィールド。§6.6）

名前付きの操作（Get、作成、ミューテーション、クエリ、検索など）は、Table定義とは別に `createOps` で定義する（§6.3、§6.4、§6.6）。公開する操作は登録簿（§7.2）に並べ、Subscriptionは登録簿でクエリに `live` を付けて公開する（§9.2）。

Table定義と操作は、ブラウザとサーバーで共有する1つの定義として書き、ブラウザに出したくない規則だけをサーバーで上書きする（§5.8）。

## 5.2 基本方針

`zod-firebase` は、単一のSchemaから識別キーの付与・除外、`createExcludedSchema` の合成、hidden化などを行って用途別のSchemaを導出していた。差し引く処理を汎用的に行うため、導出結果は `ZodType<T>` として扱っている。

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
- **キーのエンコーダー**：フィールドのSchemaから決まる、物理キーとの相互変換（§5.6）
- **射影の検証Schema**：射影だけを返すクエリ（§6.3）の結果を検証する
- **フィールドの検証Schema**：部分更新で変更する各フィールドを検証する（§6.4）

内部のSchemaと公開する型は別々に作られるため、両者の一致は型では保証されない。一致はテストで確認する。

### データの変換：ライブラリが担う

データの変換は、ライブラリの中核の機能として提供する。

- 作成時：キーの注入、createの入力とフックの戻り値のマージ
- 作成時の検証（マージした結果の全体を `item` で検証する）
- 更新時：変更するフィールドだけの差分更新（§6.4）、フックの戻り値のマージ、フィールド単位の検証、キーと `immutable` のフィールドの変更の拒否、Afterの組み立て
- 物理キー・ライブラリ管理属性の付与と除去（§5.5）
- キーのエンコードと逆算（§5.6）
- DynamoDBの属性値との相互変換（§5.7）

Schemaを差し引かずに部分更新を扱えるのは、**部分更新用のSchemaを作るのではなく、itemのSchemaを辿って変更するフィールドのSchemaを取り出し、フィールドごとに検証する**ためである。作成時は、マージした結果の全体を `item` で検証する。

## 5.3 定義例

以下は構想を示すAPI例であり、確定したインターフェースではない。

```ts
// shared/tasks.ts（共有の定義。ブラウザでも動く。§5.8）
import { z } from "zod";
import { physicalTable, tableConfig } from "@zodapp/zod-dynamodb";

// 物理レイアウト。アプリケーションで一度だけ定義する（§5.5）
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
    byStatus: { slot: "GSI1", partition: ["workspaceId", "status"], sort: ["priority", "updatedAt"] },
    byAssignee: { slot: "GSI2", partition: ["workspaceId", "assignee"], sort: ["updatedAt"] },
    byDue: { slot: "GSI3", partition: ["workspaceId"], sort: ["dueDate"] },
  },

  // ライフサイクルフック。マージする値を返す。マージと検証はライブラリが行う
  onCreate: ({ now }) => ({ createdAt: now, updatedAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});
```

`onCreate` / `onWrite` は、`zod-firebase` と同じく**マージする値を返すフック**である。フックはTable定義に書くが、呼ばれるのはサーバー（Repository）だけである（§5.8）。

作成時のデータが `item` を満たすかどうかは、型で検査する。この検査は「`create` の出力型 & キーの型 & `onCreate` の戻り値の型」が「`item` の入力型」に代入可能かを見るだけで、Schemaの引き算は行わない。上の例で `updatedAt` を返し忘れると、コンパイルエラーになる。`create` と `item` がキー以外で同じであれば、`onCreate` は不要である。

`tableConfig()` の引数側でこの検査を行うと `onCreate` の戻り値の型推論が壊れるため、検査は `tableConfig()` の戻り値の型で行い、Repositoryに渡した時点でエラーにする。

キーとIndexのフィールドには、型と定義時の実行時検査で次の制約がある。

| 対象 | 型での検査 | 定義時の実行時検査 |
|---|---|---|
| `key.partition` / `key.sort` | itemの**全variantに共通する**フィールドで、値が `undefined` にならず、出力型がキーにできる型（§5.6）であること | Schemaがエンコードできる種類であること。`.optional()` でないこと |
| `indexes.*.partition` / `sort` | **いずれかのvariant**にあるフィールドで、出力型がキーにできる型であること | 同上 |
| `indexes.*.slot` | 物理レイアウトに存在するスロットであること。同じエンティティで同じスロットを二度使わないこと | 同上 |

unionの `keyof` は共通フィールドになるため、ベーステーブルのキーにはすべてのItemが持つフィールドしか指定できない。一部のvariantにしかないフィールドをIndexに指定すると、そのvariantのItemだけが載るsparse indexになる（§5.5）。

### 変更しないフィールド（`immutable`）

キー以外のフィールドを、作成後に変更しないフィールドとして宣言できる。

```ts
immutable: ["ownerId"],
```

- 更新（部分更新、ミューテーション、`onWrite` の戻り値）でこのフィールドを変更しようとすると、エラーにする
- 値が変わらないため、書き込みの条件（`where`。§6.4）やIndexのキーに安全に使える。Indexのキーの付け直しで、先に読み取った値をそのまま使える（§6.4）

**指針**：親子関係にあるエンティティで、親のフィールド（所属する組織など）を使って認可する場合は、子にも同じフィールドを `immutable` として持たせる。子の更新や削除の認可を、親を読み取らずに子の `where` だけで表せるようになる。

### 1つのエンティティに1つのTable定義

1つのエンティティに対するTable定義は1つだけとする。同じエンティティ名を持つ複数のTable定義は、Repositoryの作成時にエラーにする。

- zod-firebaseでは、同じcollectionに複数の定義を作ることがあった。主な理由は、定義に持たせたアクセス制限（仮想のキーを必ず指定させる、など）を、システム管理者のように制限なしで扱う場面で回避するためだった。このライブラリでは、そうした制限は定義ではなく、公開する操作と認可（§8.5）と `where` で表すため、別の定義は要らない
- 読むフィールドを減らしたい場合（大きなフィールドを含まない一覧など）は、読み取るフィールドの指定（`fields` の `pick` / `omit`。§6.7）か、Indexの射影（`KEYS_ONLY` / `INCLUDE`。§5.5）で対応する

## 5.4 各Schemaと型の役割

| 名前 | 種類 | 内容 | 主な用途 |
|---|---|---|---|
| `item` | 公開Schema（利用者が指定） | 保存されるデータ。キーを含む | 読み取り結果、作成時の全体検証、更新時のフィールド単位の検証、編集フォーム |
| `create` | 公開Schema（利用者が指定） | 作成時にクライアントが渡すデータ | 作成の入力、作成フォーム |
| キーの型 | 公開する型 | `Pick<z.output<Item>, キーのフィールド>` | Get / Update / Delete の引数 |
| 部分更新の型 | 公開する型 | itemのvariantごとの `Partial` | 部分更新の入力 |
| 射影の結果の型 | 公開する型 | itemのvariantごとの `Pick`（§6.3） | 射影だけを返すクエリの結果 |
| キーの検証Schema / エンコーダー / 射影の検証Schema | 内部専用（`ZodType<unknown>` など） | itemから集めたフィールドのSchemaから作る | 入力の検証、物理キーとの相互変換 |

### Schema の前提：出力をもう一度通しても通ること

ライブラリは、同じ値を何度か `parse` する。フックの値とキーを足した後に item の Schema で検証し、読み取りでは保存した値（item の Schema の出力）を item の Schema でもう一度検証して、壊れたデータを `CorruptedDataError` で見つける。そのため、`item`・`create`・操作の `params` の Schema は、**出力をもう一度同じ Schema に通しても通る**ものに限る。

- `transform`・`pipe`（`preprocess`・`codec` も中身は `pipe`）は、入力と出力の型が違うので使えない。定義時に `DefinitionError` にする（キーのフィールドだけでなく、すべてのフィールド）
- `default`・`prefault`・`catch`・`coerce`・`trim` などは、出力をもう一度通しても通るので使える。ただしキーのフィールドでは `default` も使えない（§5.6）
- 定義時に確かめるのは、object・union・intersection・optional・array などの Schema の木の中までで、`z.custom` などの中身は確かめられない
- 共有の定義の操作（`execute`、サーバーの API、router、Gateway）では、認可の前に 1 回だけ検証し、その結果を `authorize` と書き込みの両方に使う。`default(() => randomUUID())` のように毎回違う値を作る Schema でも、認可した値と保存する値は同じになる。Repository のアクセサーを直接呼ぶ場合は、アクセサーが検証する

### 読み取り結果

読み取り結果は `z.output<Item>` そのものであり、キーを含む。物理キーの属性やライブラリ管理属性は含まない。

```ts
const task = await repository.tasks.get({ workspaceId: "ws1", taskId: "task1" });
// task: z.output<typeof tasks.item> | null
```

`version` も読み取り結果には含めない。`version` の加算はライブラリが行い（§6.4）、更新の条件は `version` ではなくフィールドに対する `where` で表すため、利用者が `version` を扱う場面はない。リアルタイム同期では `version` を使うが、これは同期プロトコルとクライアントライブラリの内部で扱う（§10.3）。

フォームで編集している間の他者による更新を検出したい場合は、`version` を直接見せずに、中身の見えないトークン（`ifUnchanged`）を使う（§6.4）。

### フォームとの連携

- 作成フォームは `create` をそのまま使う
- 編集フォームは `item` をそのまま使う。キーのフィールドを読み取り専用にするには、`zod-form` の `readOnlySchemaFields` を使う。この関数は受け取ったSchemaと同じ型を返すので、公開Schemaの型を損なわない。ライブラリが `editSchema` として提供することも検討する
- キーのフィールドに使う値の制約（§5.6）は長さの上限だけなので、通常は特別なSchemaは不要である

## 5.5 物理レイアウト

### 単一テーブルとGSIのスロット

複数のエンティティを一つのDynamoDBテーブルに置く単一テーブル設計を標準とする。物理キーの属性名は汎用的な名前にし、GSIは複数のエンティティで共有する「スロット」として使う。

| インデックス | Partition Key属性 | Sort Key属性 |
|---|---|---|
| テーブル本体 | `PK` | `SK` |
| GSI1 | `PK1` | `SK1` |
| GSI2 | `PK2` | `SK2` |
| GSI3 | `PK3` | `SK3` |

物理レイアウトは `physicalTable()` としてアプリケーションで一度だけ定義し、各Table定義から参照する。物理キーの属性名はこの定義にしか現れず、Table定義・Repository・通信プロトコルのいずれにも現れない。

- **スロットの割り当ては明示する。** Table定義の各Indexに `slot: "GSI1"` のように指定する。自動で割り当てると、Indexを一つ追加しただけで割り当てがずれ、既存データの移行が必要になるためである。
- 同じエンティティで一つのスロットを二度使うことはできない。エンティティが異なれば同じスロットを共有できる。
- ベクトルインデックスも同じくスロットとして物理レイアウトに定義する（§6.6）。
- DynamoDBのGSIの複数属性キーは使わない。スロットを共有するとエンティティごとに属性名を変えられないため、複数フィールドは連結した文字列で表す（§5.6）。

### 射影

射影は物理的なGSIの単位で決まり、エンティティごとには変えられない。そのため、**射影はスロットごとに選び**、エンティティはIndexごとに読み方に合ったスロットを選ぶ。ライブラリは次の3方式に対応し、名前付きクエリの定義は方式によらず同じとする。

| 射影 | 読み方 | 向いている場合 |
|---|---|---|
| `ALL` | Queryの結果をそのまま `item.parse` する | Itemが小さく、読み取りが多い一覧 |
| `KEYS_ONLY` | 物理キーから論理キーを逆算して返す。全体が必要ならBatchGetItemで本体を取得する | Itemが大きい、書き込みが多い、あまり使わないIndex |
| `INCLUDE` | 射影された属性と逆算したキーを返す。全体が必要ならBatchGetItemで本体を取得する | 多くのエンティティが同じ名前と意味で持つ属性（`createdAt` / `updatedAt` / `status` など）だけを一覧に出す場合 |

コストの目安：

- 読み取り：Queryは返したItemのサイズを合計して4KB単位で切り上げ、BatchGetItemはItemごとに4KBへ切り上げて課金される。Itemが小さいほど `ALL` が有利で、大きければ差は小さい。
- 書き込み：`ALL` では、ベーステーブルへの書き込みのたびにGSIにもItem全体が書き込まれる。`KEYS_ONLY` では、GSIへの書き込みは基本的にGSIのキーが変わったときだけになる。`INCLUDE` に `updatedAt` や `_version` のような毎回変わる属性を含めると、すべての書き込みがGSIに波及する。
- ストレージ：`ALL` ではGSIごとにItem全体が複製される。

単一テーブルでは、`INCLUDE` は特殊な場合にしか使えない。射影する属性の組み合わせごとにスロットが必要になり、GSIの数の上限にすぐ届くうえ、射影できる非キー属性には全Index合計で100個という上限もあるためである。また、一覧に出したい属性はIndexのキー自体であることが多く、それらは `KEYS_ONLY` でも逆算で得られる。そこで、射影は `ALL` と `KEYS_ONLY` を中心とし、`INCLUDE` は共通属性のセットに対して1本程度にとどめることを推奨する。

スロットの本数と射影の組み合わせについて、ライブラリとしての既定値は定めない。アプリケーションの読み書きの傾向に応じて決める。例えば、`ALL` を2本、`KEYS_ONLY` を2本用意する形が考えられる。

**使用上の注意：GSIのスロットの本数**：スロットはエンティティ間で共有されるため、必要な本数はエンティティのIndexの数の合計ではなく、**エンティティごとのIndexの数の最大値**で決まる（射影を分ける場合は射影ごとの最大値）。上限は、DynamoDBのGSIの上限（20本）から、同じテーブルに置くベクトルインデックスの本数を引いたものになる（§6.6）。

射影はMVPから3方式とも扱う。`INCLUDE` の型は、射影の結果の型（§6.3）に射影された属性を加えるだけである。

`INCLUDE` で射影された属性の検証は、`KEYS_ONLY` で射影だけを返す場合（§6.3）と同じく、各フィールドのSchemaで行い、フィールドをまたぐ検証は行わない。variantによってフィールドのSchemaが異なる場合は、次のように扱う。

- 判別用のフィールドが射影に含まれていれば、そのvariantのSchemaで検証する
- 含まれていなければ、いずれかのvariantのSchemaを満たせば通す

### 物理キーの形式

```text
PK  = <entity>#<f1>#<f2>…
SK  = <entity>#<f1>#<f2>…（Sort Keyがないエンティティでは <entity>）
PKn = <entity>#<f1>#…
SKn = <entity>#<f1>#…（Indexに Sort Key がない場合は <entity>）
```

各フィールドの値は §5.6 の方式でエンコードし、`#` で連結する。

- **エンティティ名はPK・SKの両方の先頭に付ける。** スロットを共有しても別のエンティティと混ざらない。SKにも付けることで、値が空になる場合でもDynamoDBで許されない空の属性にならない。
- エンティティ名は、定義時に `#` と §5.6 のエスケープ対象の文字を含まないことを検査する。
- **複数のエンティティを一度のQueryでまとめて取る使い方（item collection）は、将来も扱わない。** PKの先頭にエンティティ名を付けてPKを分散させるために、あえて選んだ形式である。フラットな設計とする方針（§4.1）とも一致する。必要な場合は、エンティティごとの名前付きクエリを並行して呼ぶ。

§5.3 の例で次のItemを書き込むと：

```ts
{
  workspaceId: "acme corp", taskId: "01JBX6Q4M2", kind: "todo", title: "設計",
  status: "todo", assignee: null, priority: 7,
  createdAt: new Date("2026-10-28T00:00:00Z"), updatedAt: new Date("2026-10-28T00:00:00Z"),
}
```

保存される属性は次のとおり。

```text
PK  = Task#acme$Pcorp         SK  = Task#01JBX6Q4M2
PK1 = Task#acme$Pcorp#todo    SK1 = Task#$*c01c000000000000#$+2026-10-28T00:00:00.000Z
PK2 = Task#acme$Pcorp#$%      SK2 = Task#$+2026-10-28T00:00:00.000Z     ← null はIndexに載る
（PK3 / SK3 は書かない）                                              ← dueDate がないvariant
_version = 1
workspaceId, taskId, kind, title, status, assignee, priority, createdAt, updatedAt
```

### 書き込みと読み取り

- **書き込み時**：論理キーから物理キーを組み立てて付ける。作成時はすべての物理キーを付ける。更新時は、変更するフィールドを使うIndexの物理キーだけを、同じ `UpdateItem` の中で付け直す（§6.4）。
- **sparse index**：Indexのキーのフィールドが一つでも存在しない（variantにフィールドがない、または値が `undefined`）Itemには、そのIndexの物理キーを書かない。複合キーの一部だけが欠けている場合も、Item全体を載せない。`null` は値として扱い、Indexに載せる（§5.6）。
- **読み取り時**：物理キーの属性とライブラリ管理属性を取り除いてから `item.parse` する。`item.parse` が未定義のフィールドを取り除くことに任せないのは、利用者が `z.strictObject` を使っていると検証に失敗するためである。

### 使用上の注意：多値の検索と、中身まで返す完全一致検索

DynamoDBのIndexは、1つのItemを1つのキーの値でしか載せられない。配列の各要素で検索する（Firestoreの `array-contains` のような）Indexはない。また、GSIは結果整合性である。

1つのItemを複数の値で引きたい場合や、完全一致の検索で強い整合性と中身の返却が必要な場合は、**値ごとに1つのItemを持つ検索用のエンティティを別に定義する**。

```text
Partition Key = [検索の範囲, 検索の種類, 値]
Sort Key      = [元のItemのID]
その他        = 検索結果として返す中身
```

- ベーステーブルのQuery 1回で、強い整合性で結果と中身を得られる
- 元のItemの値が変わったときは、古い値のItemを削除し、新しい値のItemを書き込む。元のItemと同時に書き換えるならトランザクション（§6.4）、書き込んだ後に変わらないデータなら一括での書き込み（§6.6）を使う
- GSIの本数を消費しない

### 予約名

物理キーの属性名（物理レイアウトで指定したもの）と、ライブラリ管理属性（`_version`）は予約名とする。エンティティ名はPKとSKの先頭から分かるため、エンティティの種類を表す属性は持たない。itemのフィールド名と衝突しないことを型で検査する。

## 5.6 キーのエンコーディング

### 条件

物理キーは、次の条件を満たす文字列とする。

1. **一意**：異なる値の組が同じ文字列にならない。区切り文字をエスケープしないと `("a#b", "c")` と `("a", "b#c")` が衝突する。
2. **逆算可能**：文字列から元の値を復元できる（`KEYS_ONLY` / `INCLUDE` で使う）。
3. **順序保存**：DynamoDBは文字列をUTF-8のバイト順で比較する。複合キーを値の組の順序で並べるには、エンコード後の各値に使われる文字がすべて区切り文字より大きい必要がある。
4. **Schemaによらず逆算できる**：エンコードと逆算は値と文字列だけで決まり、ZodのSchemaを使わない（下記）。そのため、Schemaの範囲指定などを変えても既存のデータは読める。

### 型識別子方式

エンコードと逆算は、ZodのSchemaを使わず、値と文字列だけで決める（`encode(value)` / `decode(string)`）。文字列以外の値は `$` + 型識別子（1文字）+ 型ごとのデータ の形にし、文字列は型識別子を付けない。逆算した値は、今までどおり内部のキー検証Schemaで検証する。利用者が方式を指定する必要はない。

| 型 | エンコード | 例 |
|---|---|---|
| `null` | `$%` | |
| `false` | `$(` | |
| `true` | `$)` | |
| 数値（整数・小数すべて） | `$*` + 順序保存したIEEE754の16桁の16進数（小文字） | `7→$*c01c000000000000`、`-1.5→$*4007ffffffffffff` |
| `Date` | `$+` + `toISOString()`（UTC、24文字） | `$+2026-10-28T00:00:00.000Z` |
| 空文字列 | `$/` | |
| 文字列 | エスケープ方式（下記） | `"t1"→t1`、`"Bob Smith"→Bob$PSmith` |

異なる型の並び順は **null < false < true < 数値 < Date < 文字列** とする（Firestoreと同じ順）。

`$` の次の文字は、次のように割り当てる。

| 文字 | 用途 |
|---|---|
| `%` (0x25) | null |
| `&` (0x26) | 予約 |
| `'` (0x27) | 使わない（シェルやログで扱いにくい） |
| `(` `)` (0x28, 0x29) | false / true |
| `*` (0x2A) | 数値 |
| `+` (0x2B) | Date |
| `,` `-` `.` (0x2C〜0x2E) | 予約（bigint など将来の型用） |
| `/` (0x2F) | 空文字列 |
| `0`〜`T` (0x30〜0x54) | 文字列のエスケープ |
| `U` 以降 | 未使用 |

型識別子を `/` より小さい記号にしたのは、文字列以外の型をすべての文字列（空文字列やエスケープで始まる文字列を含む）より前に並べるためである。英字を使うと、`" a"`（`$Pa`）は数値より前に、`"a"` は数値より後ろに並び、文字列の範囲が他の型で分断される。どの識別子も区切り文字 `#`（0x23）より大きいので、条件3を満たす。

逆算では、`$` に続く1文字で判別する。型識別子なら型ごとのデータを読み、`/` なら空文字列、`0`〜`T` なら文字列のエスケープとして読み、`$` で始まらなければ文字列として読む。

### キーに使えるSchema

値から型がわかるため、各メンバーがキーに使える種類であれば、union やliteralのunion（`"true"` と `true` など）もキーに使える。

次のものは定義時にエラーにする。

- transform、pipe、default（入力と出力のどちらをエンコードするかが曖昧になるため）
- object、arrayなど、上の表にない種類

型では、キーのフィールドの出力型が `string | number | boolean | Date | null` に収まることだけを検査する。Schemaの種類は、itemがunionやintersectionの場合に型の上でフィールドのSchemaを取り出すのが現実的でないため、定義時の実行時検査で確かめる。

### 文字列

`$`（0x24）以下の文字だけを、`$` と「元の文字コード + 0x30」の文字の2文字に置き換える。対象は制御文字、スペース、`!`、`"`、`#`、`$` である。それ以外の文字（UUID、ULID、ISO日時、日本語など）はそのまま残る。

| 値 | エンコード後 |
|---|---|
| `"w1"` | `w1` |
| `"01JBX6Q4M2"` | `01JBX6Q4M2` |
| `"東京"` | `東京` |
| `"100%"` | `100%` |
| `"a#b"` | `a$Sb` |
| `"Bob Smith"` | `Bob$PSmith` |
| `"hi!"` | `hi$Q` |
| `"$5"` | `$T5` |
| `""` | `$/` |

置き換え後の文字はすべて区切り文字 `#` より大きく、元の文字どうしの順序も保たれる。ASCII以外の文字はUTF-8で0x80以上になるので、そのままで条件を満たす。

```text
並び順：""=$/  "a"=a  "a b"=a$Pb  "a!"=a$Q  "a#"=a$S  "a$"=a$T  "a%"=a%  "ab"=ab  "b"=b
```

これにより、文字列のキーに使える文字の制限はない。残る制約は、エンコード後の長さの上限（Partition Keyは2048バイト、Sort Keyは1024バイト。GSIも同じ）だけである。

### 数値

整数と小数を区別せず、すべての `z.number()` を順序保存したIEEE754で表す。整数用と小数用で識別子を分けると、同じフィールドの1と1.5の順序が崩れるためである。

- 変換：正の値（0を含む）は符号ビットを立て、負の値は全ビットを反転する。これを符号なし64ビット整数として16桁の16進数で表す。IEEE754のビット列をそのまま使うと、負の値が正の値より後ろに並び、負の値どうしの順序も逆になるためである
- 逆算：先頭ビットが1なら符号ビットを落とし、0なら全ビットを反転する

IEEE754の方式は、値と物理キーが1対1に対応し、浮動小数点の丸めによるずれが起きない。固定小数点の10進数は採用しない。`z.number().multipleOf(0.01)` は `0.1 + 0.2`（= `0.30000000000000004`）を有効な値として受け付けるため、固定小数点に丸めると、異なる値が同じキーになったり、逆算した値と保存された値が食い違ったりするためである。読める形が必要な金額などは、整数（銭やcent）で持つことを勧める。

```ts
const view = new DataView(new ArrayBuffer(8)); // 既定でビッグエンディアン
const hex8 = (u: number) => u.toString(16).padStart(8, "0");

const encodeNumber = (n: number): string => {
  view.setFloat64(0, n === 0 ? 0 : n); // -0 を 0 にそろえる
  let hi = view.getUint32(0), lo = view.getUint32(4);
  if (hi & 0x8000_0000) { hi = ~hi >>> 0; lo = ~lo >>> 0; } // 負：全ビット反転
  else hi = (hi | 0x8000_0000) >>> 0;                        // 正：符号ビットを立てる
  return "$*" + hex8(hi) + hex8(lo);
};
```

- `Float64Array` とバッファを共有する方法はバイト順が実行環境に依存するため、`DataView` を使う
- `-0` と `0` はビット列が異なるため、そろえないと同じ値が別のキーになる
- NaNとInfinityは、zod v4の `z.number()` が受け付けないため考慮しない
- クライアントでも逆算する可能性があるため、Node専用の `Buffer` は使わない

検証済みの値：-最大値 `0010000000000000`、-1 `400fffffffffffff`、-5e-324 `7ffffffffffffffe`、0 `8000000000000000`、5e-324 `8000000000000001`、1 `bff0000000000000`、+最大値 `ffefffffffffffff`。

### Date

- タイムゾーンを持たない。常に `toISOString()` のUTC形式（`YYYY-MM-DDTHH:mm:ss.sssZ`、24文字固定）とする。JSの `Date` はある時点を表すだけの値でタイムゾーンを持たないため、失われる情報はない。タイムゾーンが必要なら別のフィールドに持つ
- 年が 0000〜9999 の範囲外の `Date` は、書き込み時のエラーにする（ISO文字列が `+010000-…` / `-000001-…` の形になり、順序が崩れるため）
- オフセット付きの日時を文字列で持つ場合（`z.iso.datetime({ offset: true })` など）は、文字列としてエンコードする。時刻順には並ばない

### nullとundefined

- **`null`**：`$%` にエンコードする。`null` は値として扱い、Indexに載せる（「担当者なし」で検索できる）。
- **`undefined`**：エンコード規則を持たない。
  - ベーステーブルのキーでは、`.optional()` のフィールドを定義時にエラーにする。
  - Indexのキーでは、フィールドが一つでも `undefined` ならそのIndexに載せない（§5.5）。
  - そのIndexに対する名前付きクエリでは、パラメーターの型から `undefined` を除く（`null` は残す）。

この既定の挙動を変えたり、エンコード方式を利用者が独自に定義したりする仕組みは入れない。

### 検査する場所

- **定義時**：Schemaの種類、エンティティ名、スロットの重複
- **書き込み時**：内部のキー検証Schemaによる値の検証、`Date` の年の範囲、エンコード後の長さの上限
- **逆算時**：逆算した値も内部のキー検証Schemaに通す。エンティティ名の接頭辞を照合し、壊れたデータや別のエンティティのItemはエラーにする

## 5.7 値の変換

DynamoDBには日付型がなく、Set型や数値精度などの固有の扱いがある。キー以外の属性について、ZodのSchemaとDynamoDBの属性値との変換は、codec層としてライブラリが担う。`zod-transform` / `zod-transport-json` の流用を検討する。

**使用上の注意：型を持たないフィールド**：codecはSchemaを手がかりに値を変換する。`z.unknown()` や `z.record(z.string(), z.unknown())` のように型を持たない部分には、JSONで表せる値（文字列、数値、真偽値、`null`、配列、オブジェクト）だけを入れる。そこに入れた `Date` などは保存時に別の形に変わり、読み取り時に元に戻らない。

## 5.8 共有の定義と、サーバーだけの上書き

Table定義と名前付きの操作は、**ブラウザとサーバーで共有する1つの定義**として書く。認可（`authorize`）、書き込みの条件（`where`）、部分更新（`patch`）も、原則として共有の定義に入れる。ブラウザに出したくない規則や、サーバー専用のモジュールを使う処理だけを、サーバーで**上書き**（`override()`）する。

```ts
// shared/context.ts（アプリで1回だけ）
export type Auth = { userId: string; workspaces: string[] };
export const { createOps, override, defineEndpoints } = defineContext<Auth>();

// shared/tasks.ts（共有。ブラウザでも動く）
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId) }),
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
    authorize: (ctx, req, shared) => shared(ctx, req) && !ctx.frozenWorkspaces.includes(req.key.workspaceId),
  }),
];
```

共有を原則にする理由は次のとおりである。

- ブラウザでも同じ判定を、送る前に同期で行える（`can`。§7.8）。ボタンの有効・無効と、サーバーの判定がずれない
- 同じ関数（`api.tasks.setStatus(key, params)`）を、ブラウザでもサーバーでも呼べる。両方で動く業務ロジックを1つ書ける（`SharedApi`。§7.8）
- 定義が1か所にまとまり、契約と実装を往復せずに読める

| 定義 | 共有の定義 | サーバーだけ |
|---|---|---|
| Table定義（`tableConfig`） | 物理レイアウト、エンティティ名、`item` / `create`、キー、Index、`immutable`、フック（`onCreate` / `onWrite`）、`generateKey`、ベクトルスロットの静的な割り当て | ベクトルの実行時の設定（`createRepository` の `vectors` と `resolveVectorConfig`。§6.6） |
| 操作（`createOps`） | 名前、`params`、`authorize`、クエリの条件、ミューテーションの `patch` / `add` / `where`、削除の `where`、検索の `partition` / `filters` | 上書き（`override()`）：`authorize`（同期だけ）、ミューテーションと削除の `patch` / `where`、検索の `queryVector`（必須） |
| 登録簿（`defineEndpoints`） | グループ、パス、HTTPメソッド、リアルタイム（`live`）、Subscriptionの `fields` | なし |

- 上書きの関数は、最後の引数で共有の関数（`shared`）を受け取る。呼べば共有の判定に足す形に、呼ばなければ置き換えになる。上書きは `createRepository({ overrides })` に渡す。同じ操作への上書きを2回渡すとエラーにする
- `authorize` を持たない操作は**サーバー専用**とし、登録簿にパスやリアルタイムを付けられない。ブラウザの API にも現れない
- フックや `generateKey` は Table定義に書くが、呼ばれるのはサーバー（Repository）だけである。共有のモジュールに置くので、サーバー専用のモジュールには依存させない。依存が必要な場合は、その処理を名前付きミューテーションにして上書きで書く
- 共有のモジュールは、Node.js専用のモジュールに依存しないことをテストで確かめる。共通のユーティリティ（IDの書式の検査、`buildFilters` など）は入れてよい。ライブラリのブラウザ向けのパッケージ（`zod-dynamodb`、`zod-dynamodb-client`、`zod-dynamodb-react`）は、Node.jsの組み込みのモジュール（`node:*`）、サーバーのパッケージ、`@aws-sdk/*` を import しないことを、ESLint の `no-restricted-imports` とテスト（`browser-safe.spec.ts`）で確かめる
- Repository（§6）は、Table定義と上書きを受け取って作る

**`authorize` が見られるもの（Getと書き込みの認可の範囲）**

- `get`・`create`・`set`・`createWithGeneratedKey` の `authorize` が見られるのは、キーと入力（送られてきた値）と認証コンテキストだけで、保存済みのItemは見られない
- 保存済みの値で判定したい書き込みは、ミューテーションや削除の `where` を使う。`where` はDynamoDBの条件付き書き込み（`ConditionExpression`）なので、使えるのはミューテーションと削除だけである。読み取り（`get`）には、DynamoDBの仕組みの上で条件を付けられない
- 読み取りを守るには、キーに所有者やワークスペースを入れて `authorize` がキーで判定できるようにするか、一覧をクエリにしてパラメーターで判定する
- 例：キーが `noteId` だけのテーブルで `set` を公開すると、入力の `ownerId` を書き換えて他人のメモを上書きできる。`set` を公開せず、ミューテーションの `where: (_p, ctx) => ({ ownerId: ctx.userId })` で「保存済みの所有者が自分」の場合だけ書き込む

---

# 6. バックエンドRepository

## 6.1 必須コンポーネント

**バックエンド用RepositoryライブラリはMVPで必須とする。**

これは、ExpressミドルウェアやRealtime Gatewayの有無にかかわらず、DynamoDBに対する型安全な操作の中核となる。

想定パッケージ：

```text
@zodapp/zod-dynamodb-node
```

バックエンドRepositoryは、次の機能を担う。

- Itemの取得
- Itemの作成
- Itemの部分更新
- 名前付きミューテーションの実行
- Itemの削除
- 名前付きクエリの実行
- 名前付きの検索（ベクトル検索）の実行
- データの変換（キーの注入、マージ、物理キーの組み立てと逆算、DynamoDB属性値との相互変換）
- 入出力のZod検証
- DynamoDB固有の操作制約の適用
- 変更イベントの生成（§11）

## 6.2 使用例

```ts
import { createRepository } from
  "@zodapp/zod-dynamodb-node";

// Table定義と、サーバーだけの上書き（§5.8）を受け取って作る
const repository = createRepository({
  tables: { tasks, rows },
  overrides, // override() の一覧
  vectors: { rows: { content: { slot: ..., filters: ... } } }, // ベクトルの実行時の設定（§6.6）
  dynamodb,
});
```

想定する操作例：

```ts
const task = await repository.tasks.get({
  workspaceId: "ws1",
  taskId: "task1",
});
// task: { workspaceId, taskId, kind, title, status, ..., createdAt, updatedAt } | null

await repository.tasks.create(
  { workspaceId: "ws1", taskId: "task1" },
  { kind: "todo", title: "設計", status: "todo", assignee: null, priority: 3 },
);

await repository.tasks.update(
  { workspaceId: "ws1", taskId: "task1" },
  { status: "done" },
);
```

名前付きの操作（§6.3、§6.4、§6.6）は、アクセサに操作を渡して実行する（`repository.tasks.mutate(taskOps.setStatus, key, params)`）。登録簿の操作を、検証と認可（`authorize`。上書きを含む）を通して実行するときは `repository.execute(op, request, { context })` を使う。`authorize` を持つ操作では `context` が必須で、渡さなければ `MissingContextError` にする。ブラウザと同じ形で呼ぶサーバーの API（`createServerApi`）は §8.2 で述べる。

トランザクションと一括での書き込み（§6.4、§6.6）は、登録簿には載せず、Repositoryの機能として使う。

読み書きするのはitemのオブジェクトだけで、物理キー、エンティティ名、`version` は現れない。

作成時のキーは、第1引数として渡す。itemのSchemaからはキーを取り除かず、ライブラリが引数のキーを注入する。

キーをライブラリやアプリケーションで生成する場合（ランダムIDなど）は、`zod-firebase` の `onCreateId` に相当するフック（`generateKey`）で生成する。`generateKey` は、`onCreate` と同じくTable定義に書く。生成されるキーを除いた型を導出するのではなく、生成に必要な値（Partition Keyなど）を、Schema（`args`）を付けて引数として受け取る。Schemaがあるので、ブラウザから呼ぶときも送る前に検証できる。フックは検証済みのcreateの入力も受け取る。作成は `create(key, input)` とは別の `createWithGeneratedKey(args, input)` で行う。公開するときは `o.createWithGeneratedKey()` で操作にする。

```ts
generateKey: {
  args: z.object({ workspaceId: z.string() }),
  key: ({ workspaceId }) => ({ workspaceId, taskId: crypto.randomUUID() }),
},
```

## 6.3 名前付きクエリ

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
    params: z.object({ workspaceId: z.string(), assignee: z.string().nullable() }),
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
  - 内部では、等値の部分を `begins_with(SK, "<entity>#v1#…#vk#")` に、範囲条件を `BETWEEN` などに変換する。上限側の境界には区切り文字の次の文字を使う。どちらも §5.6 の順序保存の条件があるから成り立つ

宣言的にしておくことで、同じ定義から次の2つを得られる。

- DynamoDBに対するQueryの実行
- JS上での所属判定 `matches(doc, params)`（リアルタイム配信のADDED / REMOVED判定に使う。§11）

所属判定は属性の値を比べるだけなので、itemがunionであっても成立する。

### 結果の型と読み方

結果の型は、そのIndexに載るvariantだけに絞り、Indexのフィールドから `undefined` を除いたものになる。例えば `byStatus` の結果は `kind: "todo"` のvariantだけになる。

`select` で、全体を返すか射影だけを返すかを選ぶ。既定は全体である。

| スロットの射影 | `select: "full"`（既定） | `select: "projection"` |
|---|---|---|
| `ALL` | Queryの結果をそのまま返す | 全体と同じ |
| `KEYS_ONLY` | Queryの後にBatchGetItemで本体を取得する | ベーステーブルのキーとIndexのキーを逆算して返す |
| `INCLUDE` | Queryの後にBatchGetItemで本体を取得する | 逆算したキーと射影された属性を返す |

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
- キー以外の条件（FilterExpression）は、読み込んだ後に適用されて `limit` の意味がずれるため、MVPでは許可しない
- 認可はクエリ名とパラメーターに対して行う（§8.5）。取得後に結果を間引く方式はとらない

FirestoreのCollection Group Queryに相当するものは、パスの概念を持たないため、単にIndexを使う名前付きクエリとして表現する。

## 6.4 更新処理

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
- 変更イベント（§11）は、このBeforeとAfterから作る
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
- **検証はフィールド単位で行う。** 変更する各フィールドを、itemのSchemaから取り出したそのフィールドのSchemaで検証する。variantによってフィールドのSchemaが異なる場合は、§5.5の `INCLUDE` と同じく、判別用のフィールドが変更に含まれていればそのvariantのSchemaで、含まれていなければいずれかのvariantのSchemaを満たせば通す
- object全体にかけた `superRefine` のような、フィールドをまたぐ検証は更新時には行わない。作成時（全体を `item` で検証する）とは扱いが異なる
- キーは引数の値で指定する。部分更新にキーのフィールドが含まれ、その値が引数のキーと異なる場合はエラーにする（キーは変更できない）
- `immutable` のフィールド（§5.3）を変更しようとした場合もエラーにする

ネストしたオブジェクトの一部だけを変える深いマージ（Firestoreの `merge: true`）は行わない。ネストしたオブジェクトのフィールドを変更すると、そのオブジェクト全体を置き換える。一部だけを変えたい場合は、読み取ってから全体を渡す。

### Indexの物理キーの付け直し

変更するフィールドがIndexのキー（ベクトルスロットの `HASH` / `INLINE_FILTER` を含む）に使われている場合は、同じ `UpdateItem` の中でそのIndexの物理キーを `SET` で付け直す。変更によってIndexのキーのフィールドが `undefined` になる場合は、物理キーを `REMOVE` してIndexから外す（§5.5のsparse index）。

物理キーを組み立てるには、そのIndexのキーを構成するフィールドすべての値が要る。

- 変更に含まれるフィールドと、ベーステーブルのキーのフィールドは、その場で値がわかる
- `immutable` のフィールドは、事前に読み取った値がその後も変わらないため、`version` の条件なしで先に読み取って使ってよい
- それ以外のフィールドが含まれる場合は、強い整合性で先に読み取り、`_version` の一致を条件にして書き込む。一致しなければ読み直して再試行する。足りない値がない更新は、これまでどおり1回の `UpdateItem` で済む
- 実行時の設定でスロットやフィルターを選ぶベクトル（§6.6）は、どのフィールドを使うかが実行時に決まるため、そのItemの更新では常に同じ方法で先に読み取る

### 読まない経路と読む経路

更新は、書き込む内容が事前にわかるかどうかで、2つの経路に分かれる。どちらの経路にするかは、Table定義と変更するフィールドからライブラリが決める。

- **読まない経路**：書き込む内容が、変更の内容、ベーステーブルのキー、`immutable` のフィールドだけで決まる場合。上の方針どおり、1回の `UpdateItem` と `ALL_OLD` で書く
- **読む経路**：それ以外の場合。強い整合性で先に読み、Beforeから書き込む内容を決め、`_version` の一致を条件に書き込む。一致しなければ読み直して再試行する

読む経路になるのは、次の場合である。

- Indexのキーの一部だけが変わり、残りのフィールドの値が必要な場合（上記）
- 判別用のフィールドを変えて、variantを切り替える場合。前のvariantにしかないフィールドと、新しいvariantでは載らないIndexの物理キーを `REMOVE` する。新しいvariantで必須のフィールドが変更に含まれていない場合はエラーにする

どちらの経路でも、BeforeとAfterは正確であり、`where` 条件もそのまま使える。

値から作る検索用のエンティティ（§5.5）は、ライブラリが自動では保たない。元のItemと一緒に書き換える必要がある場合は、アプリケーションがrunnerのtransaction（下記）で書く。

### 名前付きミューテーション

`zod-firebase` の `createCollectionMutations` と同じく、パラメーターから部分更新を作る関数を名前付きで宣言する。

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

`patch` と `where` は、ブラウザに出したくない場合やサーバー専用のモジュールを使う場合に、サーバーで上書きできる（§5.8）。上書きの `patch` / `where` は非同期でもよい。

ミューテーションの戻り値（部分更新）の検証と書き込みは、部分更新と同じくライブラリが行う。

クライアントに公開する更新は、原則として名前付きミューテーションとする（§8）。`params` は編集フォームのSchemaとしても使える。更新してよいフィールドは、ミューテーションが書き込むフィールドによって決まる。

### 原子的な加算

名前付きミューテーションは、`patch` に加えて、数値のフィールドへの加算（`add`）を返せる。`UpdateItem` の `ADD` に変換し、読み取らずに原子的に加算する。

- Afterの値は、Beforeの値に加算量を足して作る
- 対象は、どのIndexのキー（ベクトルスロットの属性を含む）にも使われていないフィールドに限る。Indexのキーは書き込む前に値を確定させる必要があるためである。`add` は値を返す関数で、対象のフィールドは呼び出すまでわからないため、この制約はミューテーションの実行時に検査する
- 加算後の値はフィールドのSchemaで事前に検証できない。範囲を保つ必要がある場合は、`where` で加算前の値に条件を付ける

### `where` 条件

名前付きミューテーションと削除には、書き込みの条件（`where`）を付けられる。条件は `ConditionExpression` に変換し、書き込みと同じリクエストでDynamoDBが評価する。

- 比較する値は、フィールドのcodec（§5.7）で変換する。Indexのキーのフィールドに対する条件も、保存されている属性の値に対して評価する
- 使える演算は、等値・比較（`eq` / `ne` / `gt` / `gte` / `lt` / `lte`）、`between`、`in`、`exists` / `notExists`、`beginsWith`、`contains`、`size` とする。いずれも `ConditionExpression` の範囲であり、フィールド同士の算術や正規表現は使えない
- 条件が成り立たない場合は書き込まず、エラーにする。`ReturnValuesOnConditionCheckFailure: ALL_OLD` で、Itemが存在しないのか、条件が成り立たないのかを区別する

更新前の状態を使う認可（「担当者だけが変更できる」「完了したものは変更できない」など）は、この `where` で表す（§8.5）。判定と書き込みが一つのリクエストで行われるため、判定の後で状態が変わる競合は起きない。

`where` は、パラメーターと認証コンテキストを受け取る関数とする（削除の `where` は、パラメーターが空のオブジェクトで、`where: (_p, ctx) => ...` と書く）。静的な条件は、引数を使わない関数として書く。

Repositoryは、Itemが存在しない場合（`ItemNotFoundError`）と、条件が成り立たない場合（`ConditionFailedError`）を区別して返す。HTTPでは、Itemの存在を認可されていないクライアントに教えないため、両者を区別せずに同じエラーとして返す。エラーのメッセージには、「Itemが存在しないか、条件を満たしていない」と両方の可能性を示す（§7.5）。

### `version`

`version` はライブラリ管理属性 `_version` として保存し、読み取り結果には含めない（§5.4）。更新のたびに `ADD _version 1` で1ずつ増やす。リアルタイム同期は、この値でイベントの新旧を判断する（§10.3）。

更新に `_version` の条件は既定では付けない。差分更新では、別々のフィールドへの同時更新は競合しない。同じフィールドへの同時更新は後勝ちとなる。読む経路（上記）では、ライブラリが内部で `_version` の条件を付ける。

### 編集中の他者の更新の検出（`ifUnchanged`）

ライブラリが読んですぐに書く場合、その間の変更は差分更新で壊れない。`_version` の条件に意味があるのは、クライアントが読んだ時点と比べる場合だけである。そのため、`version` を直接見せずに、中身の見えないトークンを使う。

```ts
const { item, token } = await repository.tasks.get(key, { withToken: true });
// …フォームで編集…
await repository.tasks.mutate(taskOps.rename, key, params, { ifUnchanged: token });
```

- トークンには `version` を入れ、カーソル（§7.6）と同じくHMACで署名する
- `ifUnchanged` を渡した書き込みは、`_version` の一致を条件にする。一致しなければ専用のエラーを返し、画面で「他の人が更新しました」と示せるようにする
- トークンを必須にする設定を、細かい単位ほど優先して置ける。`"required"` の場合、トークンのない書き込みはエラーにする

```ts
tableConfig({ ..., ifUnchanged: "required" })   // テーブルの既定。指定しなければ "optional"
o.mutation({ ..., ifUnchanged: "required" })   // ミューテーションごと
```

### 全体置換（`set`）

Item全体を新しい値で置き換える `set(key, input)` を、runnerの中と、通常のアクセサの両方で提供する。通常のアクセサの `set` は、1件だけのrunnerとして実装する（強い整合性で読み、`_version` の一致を条件に `Put` する）。

`set` をクライアントに公開するかどうかは、ほかの操作と同じくアプリケーションが決める（§8）。ライブラリは、公開する操作を制限しない。

### 使用上の注意：ネストしたオブジェクトのフィールドへの加算

`ADD` や `SET a.b = a.b + :n` のように、ネストしたオブジェクトの中のフィールドを更新するには、親のオブジェクトがItemに存在している必要がある。存在しない場合、DynamoDBは書き込みを拒否する。

- 加算するカウンターは、トップレベルのフィールドとして持つことを勧める。トップレベルのフィールドは、存在しなくても `ADD` で0から加算される
- ネストした位置に置く場合は、作成時に親のオブジェクトを作っておく

### トランザクション

DynamoDBには、読み取りと書き込みを一つにまとめる対話型のトランザクションがない。また、`TransactWriteItems` は `ALL_OLD` を返さない。

`zod-firebase` は、アクセサを `withContext({ runner })` で transaction か batch に結び付け、同じアクセサの形で両者を扱う。`zod-dynamodb` もこの形を引き継ぎ、次の2種類の実行単位（runner）を提供する。どちらも、書き込みをためておき、最後に1回の `TransactWriteItems` として原子的に確定する。

```ts
// 読み取りと書き込み（Firestore の transaction に相当）
await repository.runTransaction(async (tx) => {
  const parent = await repository.parents.withContext({ runner: tx }).get(parentKey);
  await repository.versions.withContext({ runner: tx }).create(versionKey, input);
  await repository.parents.withContext({ runner: tx }).update(parentKey, { latest: versionId });
});

// 書き込みだけ（Firestore の batch に相当）
const batch = repository.createBatch();
await repository.rows.withContext({ runner: batch }).set(rowKey, row);
await repository.rowIndexes.withContext({ runner: batch }).delete(oldIndexKey);
await batch.commit();
```

runnerに結び付けたアクセサで使える操作と、`TransactWriteItems` への変換は次のとおり。

| 操作 | 変換 | Before |
|---|---|---|
| `create(key, input)` | Put（`attribute_not_exists`） | なし（`null`） |
| `set(key, input)` | Put（置換）。全体を `item` で検証する | 事前に読む |
| `update(key, patch)` / ミューテーション | Update（§6.4の差分更新） | 事前に読む |
| `delete(key)` | Delete | 事前に読む |
| `check(key, where)` | ConditionCheck。書き込まない | 読まない |
| `get(key)`（transactionのみ） | 書き込まないItemはConditionCheck（`_version`） | 読んだ内容 |

- **Before / After**：`set` / `update` / `delete` の対象は、ライブラリが強い整合性で事前に読み、その `_version` を条件に付ける。変更イベントのBeforeはこの読み取り結果、AfterはそれにJS上で変更を適用したもの（`set` では書き込む内容そのもの）とする。`create` はItemが存在しないことを条件にするので、Beforeは `null` である
- **transactionの読み取り**：`runTransaction` の中で `get` したItemはすべて記録する。書き込んだItemには `_version` の条件を付け、読んだだけのItemは `ConditionCheck`（`_version` の一致）にする。どれかの条件が成り立たなければ、`fn` を最初からやり直す。「読んだものが変わっていればやり直す」という、Firestoreのtransactionと同じ意味になる。読み取りは書き込みより前に行う
- **batch**：利用者は読み取りを行わないが、ライブラリが内部で事前に読むため、他の更新と競合することがある。その場合はライブラリが読み直して再試行する。Firestoreのbatchは競合で失敗しないので、利用者から見える挙動は同じになる
- **条件付き更新**：runnerの中でも、`update` / ミューテーション / `delete` に `where`（§6.4）を付けられる。各操作の `ConditionExpression` に、`_version` の条件と合わせて入れる。読み取った値で判断する必要がなく、状態だけで判定できる場合は、読み取りを使わずに `where` で表すほうが往復も再試行も少ない
- **`check`**：書き込まないItemに条件だけを付ける。Itemを読まずに `ConditionCheck` にするので、「ある設定が一致していること」のような前提を、読み取りの往復なしで原子的に確かめられる
- **失敗**：`where` / `check` の条件が成り立たない場合は、再試行せずにエラーにする。`_version` の不一致による失敗だけを再試行の対象とし、回数の上限はオプションとする。どの条件で失敗したかは、`CancellationReasons` から区別する

DynamoDBの制約から、次の制限がある。

- 1回の確定で扱えるのは、読んだだけのItem（`ConditionCheck`）と `check` を含めて100件、合計4MBまで
- 同じItemを、1回の確定の中で2回以上操作できない。ライブラリは同じキーへの操作を検出してエラーにする
- transactionの中でクエリを使った場合、返ったItemの変更は `ConditionCheck` で検出できるが、条件に合うItemが新しく増えたこと（phantom）は検出できない
- 変更イベントの書き込み元（§11.5）は、どちらのrunnerでも `kind: "transaction"` とし、1回の確定で共通のIDを付ける

### 作成と削除

- 作成：`{ ...createの入力, ...onCreate(...), ...onWrite(...), ...key }` をライブラリがマージし、`item` で全体を検証する。物理キーを付け、`attribute_not_exists` による条件付き書き込み（PutItem）とし、`_version = 1` を設定する。Afterは書き込んだ内容そのものである
- 削除：`DeleteItem` に `where` の条件を付け、`ReturnValues: ALL_OLD` でBeforeを得る。Beforeは `REMOVED` イベントの生成に使う
- `delete` は常に物理削除する。zod-firebase の削除用のフック（`onNotifyDelete`、論理削除の `onDelete`）は引き継がない

### 使用上の注意：論理削除と、削除した人の記録

論理削除は、ライブラリの機能ではなく、通常の名前付きミューテーションとして書く（`deletedAt` / `deletedBy` を書き込むなど）。

- 名前付きクエリから論理削除済みのItemを除外するには、そのミューテーションでIndexのキーに使うフィールドを消すなどして、Indexに載らないようにする（sparse index。§5.5）。購読の条件から外れるので、リアルタイム配信では `REMOVED` が届く（§9.1）
- 物理的に消す必要があれば、論理削除の後でTTLなどで消す
- 削除を呼ぶ側は、エンティティごとに `delete` と論理削除のミューテーションを呼び分ける

`onNotifyDelete` は、Firestoreで削除の直前に印や更新者を書き、onSnapshotやトリガーで「削除であること」「誰が削除したか」を伝えるためのものだった。このライブラリでは変更イベントをライブラリが作り（§11）、Afterがないことで削除がわかり、書き込み元の情報もイベントに載せられるため不要である。DynamoDB Streamsでも削除は `REMOVE` として届く。削除した人を永続的に残したい場合は、runnerで `delete` と監査用のItemの `create` を1回の確定にまとめる（§6.4）。

## 6.5 Schema変更への対応

Schemaを変更すると、既存データが新しいSchemaでparseできない場合がある。名前付きクエリと検索の結果での扱いを、Repositoryのオプション（`invalidItems`）で選べるようにする。既定はエラーにする（`"throw"`）で、`"skip"` は結果から除外する。`get` は常にエラーにする。生データとして返す扱いは、必要になったときに検討する。

キーとIndexのフィールドについては、次のように整理する。

- 物理キーはSchemaを使わずに逆算できる（§5.6）。キーのフィールドのSchemaの範囲指定などを変えても、エンコードは変わらず、既存のItemは読める
- 範囲を狭めた結果、範囲外になった既存の値は、逆算はできるがキーの検証や `item.parse` でエラーになる。キー以外のフィールドのSchemaを変えた場合と同じ扱いとする
- エンティティ名、キーやIndexのフィールドの構成、スロットの割り当てを変える場合は、データ移行が必要になる
- キーに使う整数の範囲は、余裕を持って指定することを勧める

## 6.6 ベクトル検索

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

**embeddingベクトルは、itemの普通のフィールドとして持つ。** 呼び出し側がembeddingベクトルを作ってから、他のフィールドと同じように書き込む。作成・部分更新・ミューテーションのいずれも、通常の書き込みと同じ経路（§6.4）を通る。内容を変える場合は、呼び出し側が新しいembeddingベクトルも一緒に渡す。

書き込みの後でembeddingベクトルを非同期に作り、もう一度書き込む流れはとらない。書き込みが2回になり、ベクトルが古いままになる時間ができ、2回目の書き込みと他の更新とのversionの競合を避ける仕組みも必要になるなど、デメリットしかないためである。

ライブラリが行うのは、属性の対応付けと検証だけである。

- 書き込み時に、embeddingベクトルのフィールドの値を、スロットの属性名（下の `V1` など）に書き込む。読み取り時は元のフィールド名に戻す
- 次元数がスロットの設定と一致することを、書き込む前に検証する（DynamoDBは次元数が合わない書き込みを拒否するが、その前にわかりやすいエラーにする）

embeddingベクトルは数KB〜十数KBになるため、読み取り結果やリアルタイムのイベントからは、読み取るフィールドの指定（§6.7）で除外する。

### ベクトルスロット

GSIと同じく、ベクトルインデックスの属性名（ベクトル、`HASH`、`INLINE_FILTER`）はインデックスごとに固定され、エンティティ間で共有される。そこで、ベクトルインデックスも物理レイアウトの「スロット」として定義する。

```ts
export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: { /* GSI のスロット（§5.5） */ },
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

`HASH` は、GSIのPartition Keyに相当する。値は、Partition Keyと同じ形式（§5.5 / §5.6）でエンコードした文字列とする。

```text
VH1 = <entity>#<f1>#<f2>…
例：Row#p1#ds1#v3        （projectId#dataSourceId#dataSourceVersionId）
```

- エンティティ名を先頭に付けるので、同じスロットを共有しても他のエンティティと混ざらない
- 複数のフィールドを連結でき、値が空になることもない（空文字列は `HASH` に書けない）
- フィールドが `undefined` のときは書かないという §5.6 の規則が、「`HASH` の属性がないItemはインデックスに載らない」というDynamoDBの挙動とそのまま一致する
- ライブラリが常に文字列で書くため、型の不一致で書き込みが拒否される事故が起きない
- 検索は1つの `HASH` の値の範囲を超えない。この境界を、テナントやデータソースのバージョンのような、検索が決して越えない単位に合わせる
- 取りうる値の数は、少なめから中程度がよい。多すぎる（Itemごとに一意など）と近傍のItemがなく精度が落ち、少なすぎる（booleanなど）と負荷が一つの値に集中する

ベーステーブルの `PK` とは別の属性にする。`PK` はItemに近い粒度であることが多く、`HASH` に求められる粒度とは一致しないためである。

GSIのSort Keyに相当するものはない。結果は類似度の順に並ぶ。

### INLINE_FILTER

`INLINE_FILTER` は、等値条件だけの追加の絞り込みである。1つの属性に、1つまたは複数のフィールドを §5.6 の方式でエンコードして連結した文字列を書く。

- 型の衝突を避けられる：属性名はエンティティ間で共有され、型は作成時に固定される。ライブラリが常に文字列で書けば、エンティティ間で型が衝突しない
- `null` も `$%` として等値条件で検索できる
- 将来、範囲の演算子が使えるようになれば、順序を保つエンコーディングなのでそのまま範囲の条件に使える
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

`slot` と `filters` の関数は、実行時の設定を使うサーバーの処理なので、`createRepository` の `vectors` に書く（§5.8）。共有のTable定義には、スロットの静的な割り当て（`field`、`partition`、静的なフィルター）だけを置く。スロットを定義時に固定しないベクトルに `vectors` の設定がなければ、Repositoryの作成時にエラーにする。

`vectorConfig` は実行時の設定（使うスロット、フィルターの対応、embeddingモデルなど）である。次のように扱う。

- 設定は、`HASH` の範囲を代表するItem（この例ではデータソースのバージョンのItem）に持たせる。保存場所はアプリケーションが決め、ライブラリには `HASH` のフィールドの値から設定を引く関数（`resolveVectorConfig`）として渡す
- **設定は `HASH` の範囲ごとに不変とする。** Itemはその設定に従って書き込まれているので、設定を変えるなら新しい範囲（新しいバージョン）として書き込み直す。`live` のように範囲が変わらない場合も、設定を変えるときは範囲内の全Itemを書き直す
- 不変なので、ライブラリは `HASH` の値をキーにして設定をキャッシュしてよい。書き込みと検索のたびに設定を読み直す必要はない。範囲を書き直す場合に備えて、キャッシュを明示的に無効にする手段を用意する

### 名前付きの検索

検索も、名前付きクエリ（§6.3）と同じく名前付きで宣言し、クライアントからは名前とパラメーターだけを指定できるようにする。

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
    filters: (p, _ctx, { vectorConfig }) => buildFilters(vectorConfig?.filters, p.filterValues ?? {}),
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
- `select` の意味は §6.3 と同じである。`KEYS_ONLY` のスロットで `"full"` を指定すると、ベーステーブルの `PK` / `SK` からキーを逆算し、BatchGetItemで本体を取得する。`"projection"` では、逆算したキーと射影された属性を返す
- 結果の各要素は `{ item, score }` とする。`score` はItemのデータではなく検索結果に付くメタ情報なので、itemとは分けて返す。`score` の意味（小さいほど近いか、大きいほど近いか）は距離関数によって異なる
- ページネーションはなく、`topK` は100以下とする
- リアルタイムの購読は対象外とする。順位が他のItemの変更によって変わるため、§9.2の `limit` 付き購読と同じ理由で、1件の更新前後を比べるだけでは判定できない
- 認可は、名前付きクエリと同じく検索名とパラメーターに対して行う（§8.5）。`HASH` による絞り込みはIAMの境界にはならないが、バックエンドを経由するため問題にならない

### 一括での書き込み

データソースの取り込みのように、書き込んだ後は変わらないItemを大量に書き込む場合、Itemごとに条件付きで書き込む必要はない。BatchWriteItemで一括で書き込む経路を用意する。

- BatchWriteItemは条件付きの書き込みができない
- 書き込みの速度には、`HASH` の値1つあたりの上限（10MB/秒）がある
- 古い範囲（古いバージョンなど）の削除は、DynamoDBに一括削除がないためItemごとに行うか、TTLを使う。TTLで削除されたItemは、ベクトルインデックスからも削除される
- 新しい範囲に書き込み終えてから、検索が参照する範囲（「現在のバージョン」など）を切り替えれば、検索が書き込み途中のデータを見ることはない
- 一括での書き込みもリアルタイムの変更イベントの対象とする（§11.5）

## 6.7 読み取るフィールドの指定

embeddingベクトルのような大きなフィールドを毎回返さなくて済むように、読み取りで返すフィールドを指定できるようにする。

```ts
await repository.tasks.get(key, { fields: { pick: ["title", "status"] } });
await repository.rows.get(key, { fields: { omit: ["embedding"] } });
```

- 指定方法は `pick`（返すフィールド）と `omit`（除外するフィールド）の2つとする
- キーのフィールドは常に返す。どちらを指定しても、結果が「どのItemか」を失わないようにするためである
- 結果の型は、itemのvariantごとの `Pick` / `Omit` とする（§6.3の射影の結果と同じく、TypeScriptの型だけの操作）
- 対象は、Get、名前付きクエリ、名前付きの検索、Subscription（Snapshotと変更イベント）とする。名前付きクエリと検索では、定義に既定の指定を持たせ、呼び出し時に上書きできるようにする

実装：

- DynamoDBの `ProjectionExpression` は返す属性を列挙する形式しかない。`omit` は、内部でitemのSchemaからフィールド名を集め、除外したものを列挙して `ProjectionExpression` に変換する。itemに `z.record()` などフィールド名を列挙できない部分がある場合は、全体を読んでからメモリ上で除外する
- `ProjectionExpression` を使っても、消費する読み取り容量はItem全体のサイズで決まる。削減できるのは、通信量、レスポンスのサイズ、リアルタイムのメッセージサイズ（§9.4）である
- 一部のフィールドだけを読む場合は、§6.3の射影と同じく各フィールドのSchemaによる検証だけを行い、フィールドをまたぐ検証は実行しない
- 更新処理（§6.4）で `ALL_OLD` として受け取るBeforeは、常にItem全体である

---

# 7. 共通通信プロトコル

## 7.1 必須コンポーネント

**フロントエンドとバックエンド間の共通通信プロトコルもMVPで必須とする。**

通信プロトコルは、特定のExpress実装やMQTT実装に従属させない。

共有の定義と登録簿（§5.8、§7.2）に基づき、クライアントとサーバーが同じ操作とメッセージ構造を理解できるようにする。

## 7.2 登録簿

公開する操作は、アプリケーションが共有モジュールに**登録簿**（`defineEndpoints`）として書く。登録簿は、操作（`createOps` で作ったもの）を、グループに分けて並べ、パス、HTTPメソッド、リアルタイム（`live`）を付けたものである。ブラウザの API（§7.8）、サーバーの API と router（§8）、Gateway（§9.6）は、すべてこの登録簿から作る。

```ts
// shared/endpoints.ts（共有。アプリケーションが書く）
import { defineEndpoints } from "./context"; // defineContext<Auth>() が返したもの（§5.8）

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.getByPath, path: "/tasks/:workspaceId/:taskId", method: "GET" },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.remove, path: "/tasks/delete" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    { op: taskOps.byStatus, path: "/tasks/by-status", live: { fields: { omit: ["description"] } } },
    { op: taskOps.purge }, // サーバー専用（authorize がない）。サーバーの API にだけ現れる
  ],
  rows: [{ op: rowOps.similar, path: "/rows/similar" }],
});
```

- 操作の種類は、Get、Create（生成するキーの作成を含む）、Set（全体置換。§6.4）、Delete、Mutation（名前付きミューテーション）、Query（名前付きクエリ）、Search（名前付きの検索。§6.6）とする。どれを公開するかはアプリケーションが決める
- 関数の名前は、`createOps` で付けた操作の名前になる（`api.tasks.setStatus`）。同じグループで名前が重なる場合や、同じ操作を2つのグループに登録した場合は、作成時にエラーにする
- パスとHTTPメソッドは、アプリケーションが決める。ライブラリはパスの構造を定めない。HTTPメソッドの既定は `POST` で、入力をbodyに入れる。`path` のない操作はHTTPでは公開しない（リアルタイムだけ、またはサーバーだけで使う）
- `GET` を選び、パスにパラメーターを含める場合は、Clientが入力の同名のフィールドでパスを埋める。サーバー側の読み出し方は §8.3
- `live` はクエリにだけ付けられる。`live: true` か、Subscriptionの `fields` を指定したオブジェクト（§9.2）とする
- `authorize` を持たない操作（サーバー専用。§5.8）には、`path` も `live` も付けられない
- `GET` を付けられるのは、読み取りの操作（Get、Query、Search）だけとする
- `method` と `path` の組が重なる場合は、作成時にエラーにする。Express のパラメーター（`:name`）は名前によらず同じものとして比べる（`/a/:id` と `/a/:key` は重なる）。`handle()`（§8.3）で個別に公開するパスは、登録簿の外なので比べない
- 登録簿のすべての操作は、同じ `defineContext` の `createOps` で作ったものとする。`defineContext` が返す `defineEndpoints` を使うことを勧める。これは、型でも Auth の型が同じことを確かめ、実行時にもその `defineContext` の操作だけを受け付ける。`@zodapp/zod-dynamodb` から直接取り出す `defineEndpoints` は、実行時にだけ「すべての操作が同じ `defineContext` から作られていること」を確かめる。上書き（`override()`）も同じで、別の `defineContext` の操作を上書きしたり、登録簿と違う `defineContext` の上書きを `createRepository` に渡したりすると、エラーにする
- これらの検査は、作成時の `DefinitionError` で行う。サーバー専用の操作への `path`・`live`、クエリ以外への `live`、書き込みへの `GET`、別の Auth の操作は、型のエラーにもなる（エラーは該当のプロパティに出る）。名前の重なりと `method + path` の重なりは、実行時にだけ確かめる
- 各操作の入力と出力のSchemaは、操作の定義から決まる。アプリケーションがSchemaを書き直す必要はない
- Table定義をまるごと公開する汎用のエンドポイントは作らない。公開する操作は1つずつ書く
- グループ名には、ブラウザの API とサーバーの API が使う予約の名前（`context`、`endpoints`、`bind`、`execute` など）を使えない
- パスのパラメーターを埋める補助として `buildPath(path, 入力のJSON)` を用意する。入力の直下、`key`、`params` の順に同名のフィールドを探す

## 7.3 リクエストとレスポンス

| 操作 | 入力 | 出力 |
|---|---|---|
| Get | キー | `{ item: Item \| null, token? }`（トークンは常に返す。§6.4） |
| Create | `{ key, input }`（生成するキーの場合は `{ args, input }`） | `{ item }` |
| Set | `{ key, input }`（`input` はItem全体） | `{ item }` |
| Mutation | `{ key, params, ifUnchanged? }` | `{ item }`（After） |
| Delete | `{ key }` | `{}` |
| Query | `{ params, cursor?, limit?, fields? }` | `{ items, cursor? }` |
| Search | `{ params, fields? }` | `{ results: { item, score }[] }` |

- 入力は、受け取った側（サーバー）で操作のSchemaで検証する。Clientも、送る前に同じSchemaで検証する
- ブラウザの API の位置引数（§7.8）は、Clientがこの入力の形に直して送る
- `ifUnchanged` は、Getで受け取ったトークン（§6.4）である
- 出力の `item` は `z.output<Item>` であり、物理キー、エンティティ名、`version` を含まない（§5.4）
- `fields`（`{ pick }` か `{ omit }`）は、返すフィールドを絞る。キーのフィールドは常に返す。絞り込みはミドルウェアが結果に対して行うので、DynamoDBから読む量は変わらない。読む量を減らしたい場合は、Indexの射影（§5.5）を使う
- 出力のSchemaは、射影（`select: "projection"`）や `fields` で絞った結果では、itemのSchemaから返すフィールドだけを残して組み立てる。射影では、キーとIndexのキーのフィールドだけが必須で、それ以外は省略できる。組み立てられるのは、オブジェクト、union、intersectionで書いたitemのSchemaである

## 7.4 値の変換

JSONでは `Date`、`bigint`、`Set`、`Map` を表せない。HTTPの入出力の変換には、zodappの `@zodapp/zod-transport-json` を使う。

- `createJsonTransport(schema)` が、Schemaに沿って値とJSONを相互に変換する `encode` / `decode` と、JSONでの形を表すSchema（`transportSchema`）を返す。`Date` はタイムゾーン付きのISO文字列、`bigint` は文字列、`Set` は配列、`Map` はオブジェクトになる
- ライブラリは、エンドポイントごとに入力と出力のSchemaからtransportを作る。Clientは入力を `encode` して送り、出力を `decode` する。サーバーはその逆を行う
- `encode` / `decode` はどちらもSchemaで検証するので、サーバーが返す値も検証される
- DynamoDBへの保存の変換（§5.7）とは別のものとする。保存の表現（`Date` はUTCのISO文字列。キーのエンコーディングと揃える）と、通信の表現は、目的が異なるためである

## 7.5 エラー

エラーは、HTTPステータスと、bodyの `{ code, message, issues? }` で返す。WAF、ログ、監視がHTTPステータスで判断できるようにするためである。

| code | HTTP | 元のエラー |
|---|---|---|
| `INVALID_INPUT` | 400 | 入力の検証の失敗（`ValidationError`）。`issues` にZodのissueを入れる |
| `INVALID_CURSOR` | 400 | `InvalidCursorError` |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError`（認証の情報がない、正しくない、期限が切れている。サーバーの API の `context` や `checkContext` が投げる。§8.2） |
| `FORBIDDEN` | 403 | `authorize` が拒否した |
| `NOT_FOUND` | 404 | `ItemNotFoundError` と `ConditionFailedError`。メッセージは「Itemが存在しないか、条件を満たしていない」とする（§6.4） |
| `ALREADY_EXISTS` | 409 | `ItemAlreadyExistsError` |
| `CONFLICT` | 409 | `ConflictError`（再試行の上限）と、`ifUnchanged` の不一致 |
| `INTERNAL` | 500 | それ以外。メッセージは返さない |

- `FORBIDDEN` を返しても、Itemの有無は漏れない。`authorize` はItemを読まずに、パラメーターと認証コンテキストだけで判定するためである（§8.5）
- アプリケーションが `authorize` などの中で投げた独自のエラーは、変換せずにExpressの次のエラーハンドラーに渡す

## 7.6 ページネーション

DynamoDBの `LastEvaluatedKey` は、そのままクライアントに返さない。

そのまま返すと、次の問題がある。

- 最後のItemのキー値（IndexのSort Keyを含む）がクライアントに渡る。フィールド単位で返さない値をIndexのキーにしていると、トークン経由で漏れる
- 物理的なキー構造が公開APIの一部になり、Indexを変更するとクライアントが保持するトークンが壊れる
- トークンとクエリの対応がないため、あるクエリのトークンを別のクエリに渡せてしまう

そこで、`{ クエリ名, キー条件のハッシュ, 開始キー }` を不透明なトークンとし、HMACで署名する。開始キーには物理キー（§5.5）が入るが、トークンの外には出ない。受け取ったトークンは、署名とクエリ・キー条件の一致を検証してから使う。キー値自体が機微な場合は暗号化も行う。

キー条件は、パラメーターと認証コンテキストから `where(params, ctx)` で計算した物理的な条件（Index、Partition Keyの値、Sort Keyの条件）である。パラメーターではなくキー条件に結び付けるので、同じパラメーターでも認証コンテキストが違えば（別のユーザーなど）トークンは使えない。

## 7.7 リアルタイム操作

リアルタイム通信については、次の契約を定義する。

- Subscriptionの識別（Subscriptionとして公開する名前付きクエリ。§9.2）
- Subscription Parameter
- Snapshotの取得方法
- 変更イベントの形式（一括での書き込みの開始・終了イベントと、書き込み元のIDを含む。§11.5）
- イベントの順序・バージョンの扱い
- 再接続後の再同期
- Subscription終了
- 認可失敗や購読失効の扱い

これらはMQTTなどの配送基盤に依存しない論理的な契約とする。WebSocketの上で、1本の接続に複数のSubscriptionを載せる（§9.6）。

ただし、配送基盤によって保証できる順序性・再送・接続管理が異なるため、各実装の能力差まで隠蔽することはしない。

## 7.8 Client

Clientは、登録簿を実体としてimportし、ブラウザの API を作る。関数の形は、サーバーの API（§8.2）と同じである。

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
const { items, cursor } = await api.tasks.byStatus({ workspaceId: "ws1", status: "todo", minPriority: 0 });
for await (const page of api.tasks.byStatus.pages(params)) { /* ... */ }
```

- 引数は位置引数で、Getとdeleteは `(key, options?)`、createとsetは `(key, input, options?)`、生成するキーの作成は `(args, input, options?)`、ミューテーションは `(key, params, options?)`、クエリと検索は `(params, options?)` とする。`options` には、`context`、`signal`（中止）、`headers`（この呼び出しだけのヘッダー）と、操作ごとのもの（`withToken`、`ifUnchanged`、`cursor`、`limit`、`fields`）を渡す
- 戻り値は、Getが `Item | null`（`withToken: true` なら `{ item, token? }`）、作成・置換・ミューテーションが `Item`、deleteが `void`（ブラウザには削除前のItemを返さない）、クエリが `{ items, cursor? }`、検索が `{ item, score }[]` である
- Clientは、登録簿からパス、HTTPメソッド、入出力のSchemaを得る。値の変換は §7.4 のtransportで行う
- 送る前に入力をSchemaで検証し、失敗したら送らずに `INVALID_INPUT` にする
- エラーは `ClientError` として投げる。`code` は §7.5 のコードに、Clientだけのコード（`NETWORK`：通信の失敗、`UNEXPECTED_RESPONSE`：§7.5 の形でない応答、`INVALID_RESPONSE`：出力の検証の失敗、`TOO_MANY_ITEMS`：一覧の件数の上限の超過）を足したもの。`isClientError(error, "NOT_FOUND")` で `code` を絞り込める。`AbortSignal` での中止は `AbortError` のまま投げる
- `GET` のエンドポイントでは、パスのパラメーターを埋め、入力全体のJSONをクエリ文字列の `input` に入れる。サーバーでは router が読む（§8.3）
- クエリの関数は `pages(params)` を持ち、`cursor` を引き継ぎながら最後のページまで順に取る

**送る前の判定（`can`）**

各関数は `can` を持ち、共有の定義（§5.8）の判定を、送らずに同期で行う。ボタンの有効・無効などに使う。

```ts
api.context.set(auth); // ブラウザでの認証コンテキスト（グローバルな値）
const r = api.tasks.setStatus.can(key, { status: "done" }, { item: task });
// { ok: true } | { ok: false, reason: "INVALID_INPUT" | "FORBIDDEN" | "CONDITION" | "NO_CONTEXT", issues? }
```

- 入力の検証、`authorize`、`where`（`item` を渡したときだけ）の順に判定する。`item` を渡さなければ、`where` は判定しない
- `can` は共有の規則での見込みで、サーバーの上書き（§5.8）は反映しない。`can` が `ok` でも、サーバーが上書きの規則で拒否する（`FORBIDDEN` など）ことはある。最終の判定はサーバーで、サーバーの API の `can` も同じく共有の定義だけで判定する
- 認証コンテキストは、明示した `{ context }`、`bind(ctx)` で固定した値、`api.context.set()` のグローバルな値の順に使う。`context` キーを書いたら、値が `null` / `undefined` でも「認証コンテキストなし」として扱い、`bind` やグローバルの値には戻らない（§8.2 と同じ規則）。グローバルな値はブラウザでだけ使え、SSRのサーバーで設定するとエラーにする（リクエストをまたいで漏れるため）。SSRでは `bind` を使う
- HTTPでは認証コンテキストを送らない。サーバーはリクエストのヘッダーから作る（§8.2）

**両側で動くコード（`SharedApi`）**

ブラウザの API とサーバーの API は同じ形なので、両方で動く業務ロジックを1つ書ける。引数の型には `SharedApi<typeof endpoints>` を使う。ブラウザで呼べる操作（`authorize` と `path` を持つもの）だけを含み、`live` は含まない。

```ts
export const finishAll = async (api: SharedApi<typeof endpoints>, workspaceId: string) => {
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

一覧の状態は、Client の中のフレームワーク非依存の store に置く。1回きりの取得とリアルタイムの購読（§10）は、同じ状態の形を持ち、ソースを替えるだけで切り替えられる。

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

---

# 8. Express ミドルウェア

## 8.1 基本方針

バックエンドサーバー全体をライブラリが管理するのではなく、既存のExpressアプリケーションに組み込むミドルウェアを提供する。

想定パッケージ：

```text
@zodapp/zod-dynamodb-node     （サーバーの API：createServerApi）
@zodapp/zod-dynamodb-express  （router / handle）
```

- **登録簿（§7.2）から、サーバーの API と、Expressの router を作る。** パスとHTTPメソッドは登録簿に書き、ライブラリはそれをExpressのルートとして登録するだけである
- 前段のミドルウェア（レート制限など）は、アプリケーションが `app.use` で並べる。特定のパスだけに足すときは、そのパスに先にミドルウェアを置くか、`handle()`（§8.3）で個別に登録する
- Table定義を渡すとCRUD一式が公開される汎用ハンドラーにはしない。公開するのは登録簿に書いた操作だけである
- oRPCは「コントラクトファースト」の考え方の参考とする。oRPCとの統合や、oRPCと同じレイヤーを扱う密結合はしない
- ライブラリ側がExpressアプリケーションを起動したり、ポートをListenしたりすることはない

## 8.2 使用例

```ts
import type { IncomingMessage } from "node:http";
import express from "express";
import { createRepository, createServerApi } from "@zodapp/zod-dynamodb-node";
import { router } from "@zodapp/zod-dynamodb-express";
import { endpoints } from "../shared/endpoints";

const repository = createRepository({ tables: { tasks }, overrides, dynamodb });

// サーバーの API。認証コンテキストは、ここで一度だけ取り出し方を渡す
export const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // リクエストから認証コンテキストを作る
});

const app = express();
app.use(express.json());
app.use("/api", router(serverApi, { onError: (e) => logger.error(e) }));
```

- `router()` は、登録簿の `path` を持つ操作を、そのHTTPメソッドとパスで登録したExpressの `Router` を返す。サーバー専用の操作と、`path` のない操作は登録しない
- 各リクエストでは、`context(req)` で認証コンテキストを作り、入力の検証、`authorize`（上書きを含む。§5.8）、Repositoryの呼び出しの順に処理する
- 認証コンテキストの型は `defineContext<Auth>()`（§5.8）で決まり、`authorize`、`where`、`patch`、上書きで共通に使う
- `onError` を渡すと、`INTERNAL`（500）にしたエラーを受け取れる（ログ用）。既定ではログに出す
- `context` は、リクエストのヘッダー（CookieやAuthorization）から認証コンテキストを作る関数として書くことを推奨する。リアルタイムの接続でも同じ関数を使えるためである（§9.6）。認証されていないリクエストでも投げずに、匿名を表す値を返すことを勧める。`context` で投げた `UnauthenticatedError` は 401（`UNAUTHENTICATED`）にし、それ以外のエラーは、Expressの `next(error)` に渡す

**認証の情報と、認証コンテキストの確認**

認証コンテキストは、リクエストから「認証の情報」を取り出し、それから作る、という 2 段に分けられる。リアルタイムの接続で、接続を保ったまま認証の情報を入れ替えたり、サーバーから作り直させたりするためである（§9.6）。

```ts
export const serverApi = createServerApi(endpoints, {
  repository,
  // リクエストから認証の情報を取り出す。型はアプリが決める（トークンの文字列、セッション ID、証明書の情報など）
  credential: (req: IncomingMessage) => bearerTokenOf(req),
  // 認証の情報から認証コンテキストを作る。正しくなければ UnauthenticatedError
  context: async (token: string | undefined) => (token ? await verify(token) : anonymous),
  // 認証コンテキストの期限（ミリ秒の時刻）。操作の認可の前に毎回確かめ、Gateway は期限の前に作り直す
  expiresAt: (ctx: Auth) => ctx.expiresAt,
  // 期限のほかの確認（アカウントの停止など）。任意
  checkContext: (ctx: Auth) => {
    if (ctx.suspended) throw new UnauthenticatedError("suspended");
  },
});
```

認証は 3 段で考える。

| 段 | 作り方 | 期限 | 入れ替え・作り直し |
|---|---|---|---|
| 認証の情報（credential） | 利用者が送ったものから、同期か非同期で得る（`credential(req)`、Gateway の `credentialOf`） | あり（長い） | Gateway の `auth` メッセージで入れ替える。ブラウザから値を送れない方式（HttpOnly の Cookie）だけ、つながり直す |
| 認証コンテキスト（context） | 認証の情報から、同期か非同期で作る（`context(credential)`）。認可に要るデータ（ロールなど）はここで読む | あり（`expiresAt`）。認証の情報の期限を超えないように作る | Gateway は期限の前に、認証の情報から作り直す。`revalidate` でも作り直す |
| 認可（authorize） | `expiresAt` と `checkContext` の確認、操作の `authorize` | — | 操作のたびに同期で呼ぶ。データベースは読まない |

- 取り消しは、認可だけなら `revalidate`（§9.6）で認証コンテキストを作り直す。認証の取り消し（サインアウトさせる、アカウントを止める）は、アプリの `context(credential)` が失敗するようにする。JWT は署名で検証するだけなので、取り消しの状態（セッションの保存先、取り消しの一覧）を見るのはアプリの責任である
- 認証コンテキストの寿命を短くしておく（たとえば 5 分）と、`revalidate` を呼び忘れても、権限の古さはその時間までに収まる

- `credential` を省くと、リクエストそのものを `context` に渡す（`context: (req) => ctx` の書き方）
- ライブラリは認証の情報の中身を見ない。文字列のトークンを介さない方式（HttpOnly の Cookie、クライアント証明書）でも、その方式に合わせた型にすればよい
- `expiresAt` と `checkContext` は、HTTP でも Gateway でも、操作の認可の前に毎回確かめる。期限を過ぎていたら、または `checkContext` が `UnauthenticatedError` を投げたら `UNAUTHENTICATED` になる。どちらもデータベースは読まず、認証コンテキストの値だけで判定する。`can` は判定だけなので確かめない

**サーバーの API**

サーバーの API は、ブラウザの API（§7.8）と同じ形の関数を持ち、サーバー専用の操作も含む。HTTPを通らず、同じプロセスでRepositoryを呼ぶ。

```ts
await serverApi.tasks.setStatus(key, { status: "done" }, { context: auth });
await serverApi.tasks.purge(key); // サーバー専用の操作（authorize がないので context は要らない）

// リクエストの間、認証コンテキストのスコープを張る。中では context を省略できる
app.use(serverApi.scope());
app.post("/api/tasks/finish-all", async (req, res) => {
  await finishAll(serverApi, req.body.workspaceId); // 両側で動くコード（§7.8）
  res.json({});
});
```

- 認証コンテキストは、明示した `{ context }`、スコープ（`serverApi.scope()` か `runWithContext(ctx, fn)`。AsyncLocalStorage）の順に使う。`authorize` を持つ操作で見つからなければ `MissingContextError` にする
- `context` キーを書いたら（`"context" in options`）、値が `null` / `undefined` でもスコープには戻らず、「認証コンテキストなし」として扱う。値を探して見つからなかった（`{ context: bobAuth }` の `bobAuth` が `undefined`）ときに、処理中のリクエストの利用者の権限で動くのを防ぐためである。ログインしていない利用者を通したいときは、アプリがそれを表す値（ロールのない認証コンテキストなど）を渡す
- deleteは、サーバーでは削除前のItemを返す
- router と Gateway の中では、リクエストごとにスコープを張るので、そこから呼ぶ処理でも `context` を省略できる
- `serverApi.contextOf(req)` は、同じリクエスト（オブジェクト）には最初の結果を返す。`app.use(serverApi.scope())` と router を両方使っても、`credential` と `context` は 1 リクエストで 1 回だけ呼ばれる。期限（`expiresAt`・`checkContext`）は操作のたびに確かめるので、覚えた値でも期限切れは見逃さない
- `context` を渡さないサーバーの API は、サーバーの中だけで使う（明示の `context` か `runWithContext` で値を渡す）ためのものとする。これで `router()`・`handle()`・`createRealtimeGateway()` を作ると、`authorize` を持つ操作を公開する場合は作成時に `DefinitionError` にする（設定の漏れを最初のリクエストまで持ち越さないため）
- サーバーの API は `endpoints`、`contextOf(req)`、`credentialFromRequest(req)`、`contextFromCredential(credential)`、`checkContext(ctx)`、`expiresAt(ctx)`、`scope()`、`execute(entry, request)`、`authorize(entry, request)`、`repository` も持つ。これらの名前はグループ名に使えない

## 8.3 入力の読み出し

router は、`GET` の操作ではクエリ文字列の `input`（入力全体のJSON。§7.8）から、それ以外ではリクエストのbodyから入力を読む。パスのパラメーターは、Clientが入力の値で埋めたものなので、入力には使わない。

登録簿と違う形で公開したい場合（既存のURLに合わせるなど）は、`handle()` で操作を1つずつ登録し、`input` で読み出し方を差し替える。

```ts
import { handle } from "@zodapp/zod-dynamodb-express";

app.get(
  "/legacy/tasks/:workspaceId/:taskId",
  rateLimit,
  handle(serverApi.tasks.get, {
    input: (req) => ({ workspaceId: req.params.workspaceId, taskId: req.params.taskId }),
  }),
);
```

- `handle()` は、サーバーの API の関数を受け取る。サーバー専用の操作は渡せない
- `input` で読んだ値も、§7.4の変換と操作のSchemaで検証する
- HTTPのGetは、常に `ifUnchanged` のトークン（§6.4）も返す。Clientは `withToken` を指定しなければ捨てる

## 8.4 責務の分担

アプリケーション側の責務：

- Expressアプリケーションの作成と、HTTPサーバーの起動
- WAFの設定
- 認証（リクエストから認証コンテキストを作る関数）
- 登録簿（公開する操作、パス、HTTPメソッド）
- 操作ごとの認可ポリシー（`authorize` と、サーバーだけの上書き）
- ログや監視などの運用設定

ライブラリ側の責務：

- 入力の読み出し、変換（§7.4）、検証
- 認証コンテキストの取得と、認可関数の呼び出し
- Repositoryの呼び出し
- レスポンスの生成
- エラーのHTTP表現への変換（§7.5）

## 8.5 認証と認可

認証はアプリケーション側で行う。

ただし、認証と認可は分けて考える。

例えば、ログイン済みであっても、別のワークスペースのItemを読み取ってよいとは限らない。

**認可はMVPの必須要件とする。** ブラウザに公開する操作は、`authorize` を持つものに限る。`authorize` のない操作はサーバー専用になり、登録簿にパスやリアルタイムを付けると作成時にエラーにする。認可処理が未設定の場合に無条件でアクセスを許可する設計にはしない。すべて許可する操作は、`authorize: () => true` と明示して書く。

共有の定義の `authorize` も、サーバーだけの上書きの `authorize` も、同期で `boolean` を返す（ブラウザの `can` で使うため。また、Realtime Gateway が変更の配信のたびに呼ぶため）。上書きが `Promise` を返したら `DefinitionError` にする。認可に要るデータは、認証コンテキストを作るときに読む（§8.2）。`false` なら `FORBIDDEN`（§7.5）を返す。上書きの中で `ForbiddenError` を投げても同じである。拒否の理由はクライアントに返さない。理由を残したい場合は、アプリケーションが `authorize` の中でログに書く。

`authorize(ctx, request)` の `request` は、操作の種類に応じて次のものを受け取る。

| 操作 | `request` |
|---|---|
| Get | `{ key }` |
| Create | `{ key, input }`（生成するキーの場合は `{ args, input }`） |
| Set | `{ key, input }` |
| 名前付きミューテーション | `{ key, params }` |
| Delete | `{ key }` |
| 名前付きクエリ | `{ params }` |
| 名前付きの検索 | `{ params }` |
| Subscription | 購読するクエリの `{ params }`（クエリの `authorize` をそのまま使う） |

Queryの認可は、取得後にItemを間引くとPaginationや件数制限に問題が生じるため、パラメーターに対して行う。

認可関数はItemを読み取らずに判定する。更新前の状態を使う認可（担当者だけが変更できる、確定したものは変更できない、など）は、ミューテーションや削除の `where` 条件として書く（§6.4）。条件は書き込みと同じリクエストで評価されるため、判定後に状態が変わる競合は起きない。親のフィールドを使う認可は、子に `immutable` のフィールドとして持たせて `where` で表す（§5.3）。

フィールド単位の制限（更新してよいフィールド）は、名前付きミューテーションが書き込むフィールドによって表す。

## 8.6 フレームワーク非依存の中核

ミドルウェアの内部処理は、可能な限りExpressから分離する。

概念的には次の構造を想定する。

```text
Express Router（入力の読み出し、レスポンスの書き出し）
         │
         ▼
サーバーの API（認証コンテキスト、検証、認可）
         │
         ▼
Repository
         │
         ▼
DynamoDB
```

これにより、将来的にHono、Fastify、Lambdaなどに対応する場合も、サーバーの API を再利用できる。リアルタイムのGatewayも、同じサーバーの API の上に作る（§9.6）。

ただし、MVP段階から過度なフレームワーク抽象化を作ることは避ける。

---

# 9. リアルタイム同期

## 9.1 目的

DynamoDBのItem変更を、購読中のフロントエンドへ配信する。

対象となる変更は、概念的に以下の3種類とする。

- `ADDED`：購読対象に新しく含まれる
- `MODIFIED`：購読対象に含まれるItemが変更された
- `REMOVED`：購読対象から外れた

`REMOVED` はItemの削除だけを意味しない。更新によって購読条件に一致しなくなった場合（論理削除のミューテーションを含む）も含む。

## 9.2 Subscription定義

Subscriptionは、**名前付きクエリをリアルタイムで購読するもの**として定義する。購読対象の範囲と所属判定は、名前付きクエリの宣言（§6.3）から得る。インデックスに対応しない購読は定義できない。購読を始めるときにSnapshot（§10）をQueryで取る必要があり、インデックスに対応しない購読ではSnapshotを取れないためである。

Subscriptionは、登録簿（§7.2）でクエリに `live` を付けて公開する。購読の名前は「グループ名.操作の名前」（`tasks.byStatus`）になる。

```ts
export const endpoints = defineEndpoints({
  tasks: [
    // イベントとSnapshotに含めるフィールド（§6.7、§9.4）。絞らないなら live: true
    { op: taskOps.byStatus, path: "/tasks/by-status", live: { fields: { omit: ["description"] } } },
  ],
});
```

`fields` で絞っても、キーのフィールド、判別子のある union の判別子、クエリの Index のキーのフィールドは常に含める。Index のキーのフィールドは、クライアントが一覧の並べ替えと progressive のウィンドウの判定（§10.2）に使う。

必要な性質は次のとおり。

- Subscription ParameterがZodで検証される（名前付きクエリの `params`）
- フロントエンドが購読先を型安全に指定できる
- バックエンドがItemから配信先（トピック。§9.3）を導出できる
- 更新前後のItemに対して所属判定を行い、購読対象への出入りを検出できる

配信先はライブラリがクエリの定義から作る。アプリケーションが配信先の文字列や、Itemから配信先を求める関数を書くことはない。

キー以外の条件（FilterExpression）は、名前付きクエリでMVPでは許可しないため（§6.3）、購読でも扱わない。名前付きクエリで許可するときに、あらためて決める。

MVPでは、`limit` 付きの購読（上位N件など）は扱わない。他のItemの変更によって上位から押し出されるケースは、1件の更新前後を比べるだけでは判定できないためである。

## 9.3 トピックと配信先の判定

変更イベントは、MQTTの**トピック**を単位に配る。トピックは次の組から作る。

```text
トピック = {prefix}/{エンティティ}/{Index 名}/{ハッシュ}
ハッシュ = base64url(SHA-256(Partition Key の値 + Sort Key の等値の部分の値))
```

- ベーステーブルのキーで検索するクエリは、Index 名の代わりに予約の名前 `_primary` を使う。値は§5.6の方式でエンコードした物理キーの文字列で、ハッシュはWebCryptoで求める（ブラウザでも同じ関数を使える）
- クエリ名ではなく Index 名を使うので、同じ Index の上の複数のクエリでトピックを共有する。どの購読の変更かは Gateway が知っていて、`matches` は購読ごとに判定するので、正しさは変わらない
- 長さと文字が一定になるので、配送基盤の制約（AWS IoT Core の 256 バイト、`/` は 7 個まで）を気にせずに済む。ハッシュの衝突は実質的に起きず、起きても Gateway がエンティティと `matches` で判定するので誤配信にはならない
- 例：§6.3の `byStatus`（Partition Keyは `workspaceId` と `status`、Sort Keyの `priority` に範囲条件）を `{ workspaceId: "ws1", status: "todo", minPriority: 3 }` で購読すると、ハッシュの入力は `Task#ws1#todo` と `Task`（等値の部分はない）になる
- 購読者のトピックは `topicForSubscriber(subscription, params, ctx)`（`subscription` は登録簿のエントリーの `subscription`）、Itemのトピックは `topicsForItem(table, index, item)` で求める。両者が一致することをプロパティテストで確かめている
- 名前付きクエリでは、Partition Keyは常に等値の条件である。Sort Keyも、先頭から k 個は等値で指定する（§6.3）。等値の部分の値は、購読のパラメーターからも、Itemのフィールドからも1つに決まるので、両者がずれることはない
- **範囲の条件（Sort Keyの最後の範囲の部分）は、トピックに入れない。** 購読者ごとに範囲が違うためである。範囲の条件は、Gateway（§9.6）が購読ごとに `matches` で判定する。上の例では、`priority` が3未満のItemの変更は、Gatewayがその購読者には流さない
- 書き込み側は、Subscriptionとして公開した名前付きクエリごとに、BeforeとAfterのそれぞれから、等値の部分の長さ（0からSort Keyのフィールド数まで）ごとのトピックを求めて発行する。Sort Keyのフィールドは通常少数なので、発行の数は限られる
- 範囲の購読で1つのトピックに届く変更が多すぎる場合は、アプリケーションが月などの区切りのフィールドをSort Keyの等値の部分に加え、トピックを細かくする
- MQTTのWildcard Subscriptionには依存せず、完全一致のトピックを使う

**配送基盤に流すメッセージ**は、変更（`ChangeRecord`）をトピックに合わせて絞ったものとする。

- トピックは Index ごとに共有するので、書き込み側は、変更ごとに Index ごとに 1 回だけ発行する（Before と After のトピックの和に、重複なく）
- Before と After は、その Index を使う Subscription の `fields` の和に、キーと Index のキーのフィールドを足したものに絞る。どれかがすべてのフィールドを使うなら、絞らない
- Gatewayは、購読ごとに `matches(Before)` / `matches(After)` を判定し、`ADDED` / `MODIFIED` / `REMOVED`（§11.2）を決め、その購読の `fields` に絞ってから、クライアントに送る
- 一括での書き込みの開始・終了（§11.5）は、範囲（`scope`）から Partition Key が決まる Index について、範囲が含む Sort Key の先頭のフィールドの数までのトピックに発行する

**認可**

- フロントエンドは配送基盤に直接接続しない（§9.5）。トピックはサーバーの内部の名前で、認可の境界ではない
- 認可は、購読を始めるときに、購読するクエリの `authorize`（上書きを含む）をパラメーターに対して行う（§8.5）。HTTPのクエリと同じ判定になる
- Item単位の読み取り認可は、名前付きクエリと同じく扱わない。必要な場合は、`fields` でフィールドをすべて外して本体を含めない通知にし、本体はItem単位で認可するHTTPのGetで取得させる
- 接続中に権限が外れた場合は、MVPでは再接続するまで購読が続く。必要になったら、定期的に認可し直す仕組みを足す

## 9.4 配送基盤の候補

主な候補は以下のとおり。

### MQTT

想定実装：

- ローカル開発：Mosquittoなど
- AWS環境：AWS IoT Coreなど

特徴：

- 標準的なPublish/Subscribeモデル
- MQTT over WebSocketを利用可能
- ローカル開発環境を構築しやすい
- Topicによる配信先管理

### AppSync Events

特徴：

- AWSマネージドのリアルタイム通信基盤
- フロントエンドとのWebSocket通信に対応
- AWS上の認証・接続管理との統合を検討できる
- 独自Brokerの運用を減らせる可能性がある

いずれも変更イベントの配送手段として利用できる。ただし、開発の対象はMQTTとする。AppSync Eventsはローカルのエミュレーターがなく開発の負担が大きいため、MVPにも開発計画にも含めない。配送はインターフェースで分離しておく。

ただし、MQTTまたはAppSync Eventsを採用しただけで、Snapshot、認可、再同期、Item Versionの管理まで完成するわけではない。

### メッセージサイズ

配送基盤ごとにメッセージサイズの上限が異なる（例：AWS IoT Coreは128KB）。DynamoDBのItemはこれより大きくなりうる。

イベントに含めるフィールドは、Subscriptionの定義で絞り込めるようにする（例：大きな `payload` フィールドは含めない）。サイズの上限を超えたかどうかで本体の有無を切り替えることはしない。Itemごとに形が変わる分岐はテストの条件を増やし、不具合の原因になりやすいためである。

- 既定は本体（全フィールド）を含める
- Subscriptionごとに、含めないフィールドを指定できる（§6.7の `fields`）。フィールドをすべて外せば、本体を含めない通知になる（Item単位の読み取り認可が必要な場合など。§9.3）。キーのフィールドは常に含める（§6.7）
- 絞り込んだ後も上限を超えるイベントは、配信の失敗として記録する。クライアントは §10.4 の再同期で回復する

## 9.5 フロントエンドの接続経路

データアクセスについては、WAFを経由したバックエンドAPIを標準経路とする。

リアルタイム通信については、以下の二案がある。

**A. バックエンド経由**

```text
Frontend
   │
   ▼
WAF
   │
   ▼
Realtime Gateway
   │
   ▼
MQTT / AppSync Events
```

**B. 配送基盤へ直接接続**

```text
Frontend ── WAF ── Backend API
    │
    └──────── MQTT / AppSync Events
```

**Aを標準構成とする。**

WebSocketでは、WAFが検査するのは主に接続確立時のリクエストだが、未認証の接続や特定ユーザーからの接続を入口で遮断できることに十分な意味がある。また、公開入口をWAFに集約するという設計目的とも一致する。

Bは技術的に可能だが、公開入口が分かれるため、正式にはサポートしない。

WAF製品や配信基盤によって保護可能な通信経路が異なるため、具体的な構成で適用可能性を検証する。

## 9.6 Gatewayの提供形態

リアルタイム接続も、Expressのアプリケーションに統合して提供する。ただし、Expressのミドルウェアの形にはせず、**フレームワークに依存しないGatewayを中核とし、Node.jsの `http.Server` に取り付ける補助を用意する**。

```ts
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

const realtime = createRealtimeGateway({
  api: serverApi, // createServerApi(endpoints, { repository, context })。§8.2
  transport: mqttTransport({ url: process.env.MQTT_URL }),
  maxPageSize: 1_000, // 1 ページの件数の上限（既定）
  origin: ["https://app.example.com"], // upgrade の Origin ヘッダーを確かめる。省略すれば確かめない
  maxSubscriptionsPerConnection: 100, // 1 本の接続の購読の数の上限（既定）
});

const server = app.listen(3000);
realtime.attach(server, { path: "/api/realtime" });
```

- **接続の粒度**：WebSocketの口は1つとし、1本の接続の上で複数のSubscriptionの購読と解除を行う。画面で複数の一覧を購読しても、接続は増えない
- **公開と認可**：公開するSubscriptionは、登録簿で `live` を付けたクエリだけである。認可はクエリの `authorize`（上書きを含む）で行い、HTTPと同じ判定になる
- **中核**：Gatewayの中核は、`handleUpgrade(req, socket, head)` を持つフレームワーク非依存の部品とする。`attach` はその上の薄い補助で、Express以外（Fastify、素のNode.jsなど）でも、アプリケーションが `upgrade` イベントに自分でつなげられる
- **ミドルウェアにしない理由**：WebSocketの接続はHTTPのupgradeで始まり、`http.Server` の `upgrade` イベントに届く。Expressのルートやミドルウェアの連鎖は通らないため、既存の認証ミドルウェアも実行されない。また、Gatewayは接続の一覧、配送基盤との接続、購読中のトピックという状態を持ち、サーバーの起動と停止に合わせて開始・終了する必要がある
- **認証**：upgradeのリクエストでは認証ミドルウェアが動かないので、Gatewayはサーバーの API の `context`（§8.2）でupgradeのリクエストから認証コンテキストを作る。リクエストのヘッダー（CookieやAuthorization）から作る関数にしておけば、HTTPと同じ関数を共有できる。購読とページの読み取りは、その認証コンテキストのスコープの中で行う
- **Snapshot**：Gatewayは「購読」と「ページ」の 2 つの部品だけを持つ（§10.2）。ページは、購読した名前付きクエリを、購読のパラメーターと認証コンテキストで 1 ページだけ読み、`version` 付きで返す。progressive か全体か、どこまで読み込んだかは知らず、バッファも持たない。サーバーの負担は、1 ページの大きさ（`maxPageSize`）で上限が決まる
- **Origin の確認**：`origin`（オリジンの配列か、`(origin, req) => boolean`）を指定すると、upgrade の最初、認証コンテキストを作る前に Origin ヘッダーを確かめ、許可しなければ 403 で拒否する。配列は完全一致で比べる（末尾の `/` や大文字小文字の違いは許さない）。Origin ヘッダーのないリクエストは通す（関数も呼ばない）。Origin を送るのはブラウザだけで、Cross-Site WebSocket Hijacking はブラウザでしか起きないためである。省略すれば確かめない。Cookie で認証するアプリでは指定する
- **認証の失敗**：upgrade のときに `context` か `checkContext` が投げたら、upgrade を 401 で拒否する
- **操作のたびの確認**：購読の開始、ページの読み込み、変更の配信の前に、そのたびに期限（`expiresAt`）と `checkContext`、購読したクエリの `authorize` を同期で確かめる。認証の失敗（`UNAUTHENTICATED`）なら、`id` のない `error` を送って接続を閉じる（コード 4401）。クライアントはつながり直し、upgrade のリクエストで新しい認証の情報を渡す。認可の拒否（`FORBIDDEN`）なら、その購読だけを止め、接続とほかの購読は続ける。認証が切れた状態でメッセージを溜めるような中間の状態は持たない
- **認証の情報の入れ替え**：トークンの期限が短い（5 分など）と、期限のたびにつながり直すのは多すぎる。そこで、期限が来る前にクライアントが `auth` メッセージ（§10.5）で新しい認証の情報を送り、接続を保ったまま認証コンテキストを入れ替えられる。Gateway の `credentialOf(payload)` で `payload` を認証の情報に直し、`context` で作り直して、開いている購読をすべて認可し直す。作れなければ接続を閉じ、認可の通らない購読と、範囲が認証コンテキストで決まり範囲の変わった購読は `FORBIDDEN` で止める。`credentialOf` を渡さなければ `auth` メッセージは受け付けない（Cookie や証明書のように、ブラウザから値を送れない方式では、期限が来たらつながり直す）
- **作り直し（`revalidate`）**：メンバーから外した、アカウントを止めたなどの緊急のときに、`realtime.revalidate(filter?)` で、`filter` に合う接続（省けばすべて）の認証コンテキストを、最後に受け取った認証の情報から作り直す。その後は `auth` メッセージと同じに扱う
- **期限の前の作り直し**：`expiresAt` を返す認証コンテキストは、寿命の `rebuildAt`（既定 0.8）の時点で、最後に受け取った認証の情報から作り直す。ロールの変更などは、`revalidate` を呼ばなくても遅くともこの時点で反映される。作れなければ接続を閉じる。同じ認証の情報から作り直して期限が延びなければ（認証の情報そのものの期限が来た）、もう作り直さない。作り直しの間に届いた変更は、まだ期限の切れていない前の認証コンテキストで配信する。作り直しと `revalidate` は、同時に `maxConcurrentRebuilds`（既定 10）本までに抑える
- **購読の数の上限**：1 本の接続で同時に持てる購読（認可の途中のものも含む）は `maxSubscriptionsPerConnection`（既定 100）までとする。超えた `subscribe` には、その `id` で `INVALID_INPUT`（`too many subscriptions on this connection`）を返す。解除すれば減る
- **トピックの参照**：同じトピックは接続をまたいで 1 回だけ配送基盤で購読し、参照を数える。解除と切断で減らし、0 になったら購読をやめる
- **配信**：Gatewayは、購読中のSubscriptionのトピック（§9.3）を配送基盤で購読し、届いたメッセージを購読ごとに判定して、該当する接続に流す
- 書き込み側の発行（RepositoryのChangeListener。§11）は、配送基盤のパッケージ（`zod-dynamodb-mqtt`）が提供する。発行するトピックは、登録簿で `live` を付けたクエリから決める（`mqttPublisher({ url, endpoints })`）

---

# 10. リアルタイム同期の整合性

## 10.1 SnapshotとSubscription

リアルタイム同期には、現在の状態を取得するSnapshotと、その後の変更を受け取るSubscriptionの両方が必要となる。

単純に次の順序で処理すると、取りこぼしが発生する可能性がある。

```text
1. Snapshot取得
2. Subscription開始
```

Snapshot取得後、Subscription開始前に発生した変更を受け取れないためである。

逆にSubscriptionを先に開始しても、それだけで正確な初期状態が保証されるわけではない。

## 10.2 初期同期の手順

次の手順を標準とする。

```text
1. Subscriptionを開始し、届いたイベントはキーごとに「最新のversionと値（削除ならTombstone）」として覚える
2. Subscriptionの準備完了（ready。配送基盤が購読を受け付けた）を待つ
3. Snapshotをページ単位で取得する（各Itemのversionを含む）
4. ページのItemと覚えていた値をversionで突き合わせ、新しい方を残す
5. 以降はイベントを継続的に適用する
```

この手順はクライアントで行う。サーバー（Gateway）は購読とページの部品を提供するだけである（§9.6）。

**全体と progressive**

| | 全体の購読 | progressive（`pageSize` を指定） |
|---|---|---|
| 次のページ | `cursor` がなくなるまで自動で頼む。`maxSnapshotItems` を超えたらエラー | `fetchMore` のときだけ頼む |
| 一覧に出すもの | 条件に合うものすべて | ウィンドウ（最後に読んだページの境界まで）の中だけ |
| 再接続 | 1 からやり直す（Tombstone は残す） | 1 からやり直し、読み込んでいた件数まで読み直す |

- 一覧の並び順は、名前付きクエリの Sort Key と方向に合わせる（同じ Sort Key の Item はベーステーブルのキーの順）
- ウィンドウは件数ではなく Sort Key の境界で決まるので、「上位 N 件」から押し出される問題（§9.2）は起きない。新しい Item が来れば、一覧はそのまま伸びる
- ウィンドウの外の変更は 60 秒だけ覚えて捨てる。GSI は結果整合性なので、変更の直後に遡って読んだページが古いことがあり、それを `version` で直すためである
- 読み直しの途中は、前の一覧を出したままにする
- 一括での書き込み（§11.5）は、既定では個々のイベントを適用する。`onBatch: "reload"` を指定すると、開始から終了までのそのイベントを適用せずに待ち、終了で読み直す

この手順を成立させるために、次の条件を設ける。

- SnapshotにはItemの `version` を含める。`ALL` のスロットではGSIから `_version` が得られる。`KEYS_ONLY` / `INCLUDE` のスロットでは、BatchGetItemで本体を強い整合性で読むときに得る（§6.3）。このため `INCLUDE` に `_version` を含める必要はない
- 削除や購読対象からの除外（`REMOVED`）にも `version` を持たせる
- クライアントは、`REMOVED` を受け取ったItemを、その `version` とともにTombstoneとしてメモリ上に保持する。保持するのは購読している間ずっととし（progressive ではウィンドウの中のもの。外のものは 60 秒）、購読をやめれば捨てる。取り直したSnapshotも古いことがあるため、Snapshotを取り直しても捨てない。Tombstoneはキーと `version` だけなので、メモリへの影響は小さい

Tombstoneがないと、GSIの結果整合性によって遅れて取得されたSnapshotが、すでに削除されたItemを復活させてしまう。

GSIからの読み取りは常に結果整合性であり、強い整合性で読めない。上記の手順は、この遅れを `version` の比較で吸収するためのものである。

この手順により、**イベントが欠落しない限り**、クライアントの状態はサーバーの状態に収束する。

## 10.3 Item Version

Item単位のVersionを導入する。

```ts
{
  workspaceId: "ws1",
  taskId: "task1",
  version: 12,
  ...
}
```

`version` は作成時に1とし、更新のたびに `UpdateItem` の `ADD` で1ずつ増やす（§6.4）。変更イベントにもVersionを含める。

`version` は同期プロトコルのメタ情報であり、Snapshotや変更イベントの中でItem本体とは別に運ぶ。Repositoryの読み取り結果（§5.4）や、クライアントがアプリケーションに渡すデータには含めない。上の例は概念を示すもので、Item本体のフィールドとして `version` を持つ意味ではない。

これにより、フロントエンドでは以下を判断できる。

- 重複したイベント
- 既に適用済みのイベント
- 古いイベント
- 明らかなVersionの飛び

ただし、Item単位のVersionでは、イベントの欠落そのものは検出できない。検出するには、トピック単位の連番が必要になる。

## 10.4 再接続と再同期

MVPでは、**再接続時にSnapshotを取り直す**ことを基本の復旧方法とし、保証する範囲を次のように明示する。

- 接続中は、イベントが欠落しない限り状態は収束する
- 接続が切れた場合は、再接続後のSnapshot再取得によって回復する
- 接続中のイベント欠落（配送基盤の取りこぼし、Publish失敗）は、MVPでは検出を保証しない。必要に応じて定期的なSnapshot再取得で回復する

変更履歴のReplayや、トピック単位の連番による欠落検出は、MVP以降の検討事項とする。

クライアントは接続を 1 本だけ持ち、切れたら間隔を広げながら（既定 0.5 秒から 2 倍ずつ、上限 30 秒）再接続して、すべての購読を 1 からやり直す。購読がなくなったら接続を閉じる。

## 10.5 Gatewayとクライアントの間のメッセージ

すべて JSON で、Item・キー・パラメーターの値は §7.4 の transport で変換する。`id` はクライアントがつける購読の番号で、1本の接続の上の複数の購読を区別する。形式は `zod-dynamodb` の `realtime-protocol` に、Zod の Schema とともに置く。

```ts
// Client → Gateway
{ type: "subscribe", id: 1, name: "tasks.byStatus", params: { workspaceId: "ws1", status: "todo" } }
{ type: "page", id: 1, cursor?: "…", limit: 100 }
{ type: "unsubscribe", id: 1 }
{ type: "auth", payload: { token: "…" } } // 認証の情報の入れ替え（§9.6）。payload の形はアプリが決める

// Gateway → Client
{ type: "ready", id: 1 }
{ type: "page", id: 1, items: [{ item, version }], cursor?: "…" }
{ type: "change", id: 1, change: "ADDED" | "MODIFIED" | "REMOVED", key, item?, version, origin }
{ type: "batch", id: 1, marker: { type: "BATCH_STARTED" | "BATCH_FINISHED", origin, count?, status? } }
{ type: "error", id?: 1, code, message }
```

- `REMOVED` では `item` を省き、`key` と `version` だけを送る
- `error` に `id` があれば、その購読は終わっている（`authorize` の失敗は `FORBIDDEN`、ページのトークンの誤りは `INVALID_CURSOR` など）。`id` がなければ接続全体のエラー。接続全体の `UNAUTHENTICATED` の後は、Gateway が接続を閉じる（コード 4401）
- `auth` には成功の応答を返さない。失敗したときだけ、上のエラーで知らせる
- `change` の種類は、Gateway が `matches(Before)` / `matches(After)` で決めたもの（範囲の条件による出入り）。progressive のウィンドウによる出入りは、クライアントが決める

---

# 11. 変更イベントの生成

## 11.1 基本方式

MVPでは、**バックエンドRepositoryによる書き込みから変更イベントを生成する（ラッパー方式）**。

§6.4の方式で得た正確なBeforeとAfterを、トピック（§9.3）に発行する。所属判定は、配送基盤から受け取ったGateway（§9.6）が購読ごとに行う。

```text
UpdateItem（差分、where、ReturnValues: ALL_OLD）
       │
       ▼
Before（ALL_OLD）
       │
       ▼
After = Before に変更をJSで適用
       │
       ▼
Before / After からトピックを求めて発行（MQTT）
       │
       ▼
Gateway：購読ごとに matches(Before) / matches(After)
       │
       ▼
ADDED / MODIFIED / REMOVED をクライアントに送る
```

所属判定には、名前付きクエリの宣言から得た `matches` を使う（§6.3）。

## 11.2 Before / Afterの判定

| 更新前 | 更新後 | イベント |
|---|---|---|
| 対象外 | 対象内 | ADDED |
| 対象内 | 対象内 | MODIFIED |
| 対象内 | 対象外 | REMOVED |
| 対象外 | 対象外 | 配信不要 |

この判定は、Itemの物理的なCreate/Update/Deleteとは分けて考える。

判定は購読ごとに行う。例えば `status` が `todo` から `done` に変わった場合、変更はBeforeから求めた `…/todo` のトピックと、Afterから求めた `…/done` のトピックの両方に発行される。`todo` の購読者には `REMOVED`、`done` の購読者には `ADDED` が届く。範囲の条件だけが変わった場合（`priority` の変更など）は、同じトピックの上で、購読ごとの範囲に応じて `ADDED` / `MODIFIED` / `REMOVED` が決まる。

## 11.3 DynamoDB書き込みと配信の非原子性

DynamoDBへの書き込みとMQTT・AppSync EventsへのPublishは、一つの原子的なトランザクションにはならない。

```text
DynamoDB書き込み成功
        │
        ▼
Event Publish失敗
```

MVPでは、この欠落を §10.4 の範囲（Versionと再同期による回復）で扱う。Publishの失敗はログに記録し、再試行可能にする。

## 11.4 ラッパー方式の限界とDynamoDB Streams

ラッパー方式では、ライブラリを経由しない書き込み（マイグレーション、管理スクリプト、コンソールからの操作など）はイベントにならない。

これが問題になる場合の代替として、DynamoDB Streamsを起点にイベントを生成する方式がある。Streamsは変更前後のItemを提供するため、その場合は §6.4 のAfterの組み立てはイベント生成のためには不要になる。書き込みの方式（差分更新と `where` 条件）は変わらない。

ラッパー方式とStreams方式は二者択一である。Streams方式は仮定の代替案であり、開発計画（MVPとその次の範囲を含む）には入れない。イベントの発行をインターフェースとして分離しておくことだけを行う。

## 11.5 一括での書き込みとイベント

一括での書き込み（§6.6）も、リアルタイムの変更イベントの対象とする。

- 一括での書き込みごとにIDを発行し、開始イベントと終了イベントを配信する
- 個々のItemの変更イベントにも、そのIDを含める
- 開始・終了イベントは、書き込みの範囲（`HASH` の範囲など）から決まるトピック（§9.3）に配信する。そのため、一括での書き込みは開始時に範囲を宣言する
- 終了イベントには、書き込んだ件数と、成功したか中断したかを含める

これにより、クライアントは次のように使い分けられる。

- 通常どおり個々のイベントを適用する
- 開始から終了までの個々のイベントを適用せずに待ち、終了イベントを受け取ったらSnapshotを取り直す（大量のイベントを個別に処理しないで済む）

書き込み元のIDは、一括での書き込みに限らず、すべての変更イベントに持たせる。

```ts
{
  type: "ADDED" | "MODIFIED" | "REMOVED",
  key, item, version,
  origin: { kind: "single" | "transaction" | "batch", id: string },
}
```

`kind: "batch"` は一括での書き込み（§6.6）を指す。runnerの `createBatch`（§6.4）による書き込みは `"transaction"` とする。同じトランザクションで発生したイベントにも共通のIDが付くので、監査や、関連する変更をまとめて扱う用途に使える。

一括での書き込みは、更新前のItemを読まない（§6.6）。そのため、新しいItemの書き込み（`ADDED`）を前提とする。既存のItemを上書きする場合は、通常の書き込みの経路（§6.4）を使う。

---

# 12. CDK対応

## 12.1 方針

CDKは、ライブラリのパッケージ（`packages/`）としては提供せず、**サンプルアプリケーション（`apps/`）のスタックとして提供する**。

部品を切り出してパッケージにしても、利用者がそのまま使う場面は少ないと考えるためである。WAF、API Gateway、Load Balancer、ECS、Lambda、IoT Coreなどの構成はアプリケーションごとの差が大きく、利用者は自分のスタックに必要な部分を写して使うことになる。サンプルは、その手本として、動く形で示す。

## 12.2 サンプルに含めるもの

- DynamoDBのテーブルとGSI（物理レイアウトから。§12.3）
- ベクトルインデックス（物理レイアウトのベクトルスロットから）。CloudFormationが対応しているかはサンプルを作るときに確認し、対応していなければカスタムリソースで作る
- リアルタイム配信に必要なリソース（IoT Coreのトピックとポリシーなど）
- アプリケーションに必要な最小限のIAM Policy
- バックエンド（Expressのアプリケーション）の実行環境と、WAF

## 12.3 Table定義との関係

インフラ設定は、Table定義ではなく物理レイアウト（`physicalTable()`。§5.5）から導出する。物理テーブル、Key Schema、GSIのスロットと射影は、物理レイアウトだけで決まる。

複数のTable定義が同じ物理テーブルやGSIを共有するため、Table定義と物理インフラ定義は同一視しない。サンプルのスタックは、共有の定義（§5.8）の物理レイアウトをimportして、テーブルとIndexを作る。

---

# 13. パッケージ構成と責務

想定するパッケージの責務を以下にまとめる。

| パッケージ | 主な責務 | 実行環境 | MVP上の位置づけ |
|---|---|---|---|
| `zod-dynamodb` | 物理レイアウト、Table定義、キーのエンコーディング、操作の定義（`createOps`）と上書きの型（§5.8）、登録簿（§7.2）とブラウザ・サーバーの API の型、`can` の判定、エラーコード、通信の変換（§7.4）、トピックの導出（§9.3）、配送のインターフェース（`RealtimeTransport`）と配送によらない発行（`createChangePublisher`）、Gatewayとクライアントの間のメッセージ（§10.5） | ブラウザ・Node.js | 必須 |
| `zod-dynamodb-node` | DynamoDB Repository、CRUD、Query、ベクトル検索、一括での書き込み、変更イベント生成、ページネーションのトークンの署名、サーバーの API（`createServerApi`） | Node.js | 必須 |
| `zod-dynamodb-express` | 登録簿から作るExpressの router（`router` / `handle`）、エラーのHTTP表現 | Node.js | 候補（Phase 2） |
| `zod-dynamodb-client` | 登録簿から作るブラウザの API（fetchのラッパー）。1回きりの取得とリアルタイムの購読の store（§7.8、§10） | ブラウザ・Node.js | 実装済み（Phase 3〜4） |
| `zod-dynamodb-react` | Reactのhooks（`createUseList`、`createUseItem`、`ApiProvider`、`useApi`）。store を読むだけ | ブラウザ | 実装済み（Phase 4） |
| `zod-dynamodb-realtime` | Realtime Gateway（フレームワーク非依存の中核と、`http.Server` への取り付け）。クライアント側の購読の処理は `zod-dynamodb-client` に置く | Node.js | 実装済み（Phase 4） |
| `zod-dynamodb-mqtt` | MQTTを利用する配送（`mqttTransport`、書き込み側の発行 `mqttPublisher`） | Node.js | 実装済み（Phase 4） |
| `zod-dynamodb-appsync` | AppSync Eventsを利用する配送実装 | — | 開発計画に含めない（§9.4） |

CDKはパッケージにせず、サンプルアプリケーションとして提供する（§12）。

通信プロトコルの型とSchemaは、独立したパッケージにせず `zod-dynamodb` に含める。`zod-dynamodb` はNode.js専用の依存を持たず、ブラウザでも動くため、共有の定義を置いても §13.1 の原則に反しない。通信の変換には、zodappの `zod-transport-json` を使う。

## 13.1 パッケージ分割の原則

パッケージ数を最初から増やすこと自体を目的としない。

次の条件がある場合に分割する。

- Node.js専用依存をブラウザ側に含めたくない
- Express、Reactなどの依存をオプショナルにしたい
- 配送基盤ごとに導入を選択できるようにしたい
- 明確に異なる公開APIや実行環境を持つ

---

# 14. MVPの範囲

## 14.1 必須要件

MVPに必須の要素は次の5つとする。

### A. 共通Table定義

- item（キーを含む）とcreateのSchemaの個別指定（union / intersectionなども可）
- 受け取ったSchemaをそのまま保持し、型を損なわないこと（公開Schemaに差し引く操作はしない）
- キーをitemのフィールド名の並びで指定すること
- ライフサイクルフック（`onCreate` / `onWrite` など。マージする値を返す）
- 共有の定義と、サーバーだけの上書き（§5.8）
- 物理レイアウト（単一テーブル、GSIのスロット、スロットごとの射影）と、Indexのスロットへの明示的な割り当て
- 型識別子方式のキーのエンコーディングと逆算（Schemaを使わない）
- 名前付きクエリ・名前付きミューテーション
- Subscriptionの定義（名前付きクエリと `fields`）

### B. バックエンドRepository

- DynamoDBとの接続
- 型安全なCRUD
- 名前付きクエリの実行（`ALL` / `KEYS_ONLY` / `INCLUDE` の読み方）
- 物理キーの付与・除去と、キーの逆算
- Zod検証
- 差分更新（`UpdateItem` と `ALL_OLD`）と、`where` による条件付き書き込み
- 正確なBefore / Afterの取得と変更イベントの生成

### C. 共通通信プロトコル

- 登録簿（§7.2）
- 共通エラー形式（§7.5）
- 通信の値の変換（§7.4）
- 署名付きのページネーショントークン
- Subscriptionの契約
- 変更イベント形式
- Snapshotと再同期の基本的な意味

### D. 認可の枠組み

- 公開する操作（エンドポイントとSubscription）を1つずつ登録すること
- 操作ごとの認可関数（型レベルで必須）
- 更新前の状態を使う認可と、条件付き書き込みの組み合わせ

### E. ベクトル検索

- 物理レイアウトでのベクトルスロットの定義（次元数、距離関数、`HASH` と `INLINE_FILTER` の属性名）
- `HASH` のエンコーディングと、`INLINE_FILTER`（静的・動的）
- embeddingベクトルの次元数の検証と、スロットの属性名への対応付け
- 名前付きの検索（`o.search`）と、その認可
- 一括での書き込み

これらは、具体的なHTTPサーバー実装やフロントエンドSDKが完成していなくても成立するライブラリの中核となる。

## 14.2 MVPに追加する実装候補

以下はMVPで実装する有力候補だが、必須要件とは区別する。

**Express ミドルウェア**

エンドポイントごとのミドルウェアを提供し、アプリケーションが既存のルートに組み込めるようにする（§8.2）。

**Frontend Client**

共通の定義に基づいてバックエンドAPIを型安全に呼び出す。

**RealtimeのReference Implementation**

MQTTとRealtime Gateway（§9.6）を使った、実際に動作するSubscriptionの例を提供する。

MVPでは、これらをすべて完成させることよりも、共通定義・Repository・通信契約・認可が矛盾なく接続できることを重視する。

ただし、利用者が容易に評価できるように、少なくとも一つの動作するEnd-to-Endサンプルを提供することが望ましい。サンプルは `apps/` に置き、CDKのスタック（§12）も含める。

---

# 15. テスト方針

## 15.1 Schemaと型のテスト

- 受け取ったSchemaの型が保たれること（`ZodDiscriminatedUnion` の `.options`、`ZodIntersection` の各辺など）
- キーやIndexに存在しないフィールドを指定するとコンパイルエラーになること（unionの一部のvariantにだけあるフィールドは許可）
- createの入力と `onCreate` の戻り値でitemを満たせない場合にコンパイルエラーになること
- 操作の型（名前、`ctx` の型、ブラウザとサーバーの API の形）が定義から決まること。共有のモジュールがNode.js専用のモジュールに依存しないこと
- 部分更新の型がitemのvariantごとの `Partial` になること
- 保存された属性全体を `item.parse()` に通したとき、ライブラリ管理属性が結果に現れないこと
- 内部のキー検証Schemaが受け付ける値と、公開するキーの型が一致すること
- 一部のvariantにしかないフィールドをキーに指定するとコンパイルエラーになること
- itemにキーと同名のフィールドがある場合の値の一致検証
- キーにできない型（object、arrayなど）や `.optional()` のベーステーブルのキーを拒否すること（型と定義時）。union / literalのunionのキーがエンコードと逆算で往復できること
- 同じエンティティでのスロットの重複を拒否すること
- 名前付きクエリで、Sort Keyの先頭を飛ばした条件がコンパイルエラーになること
- 名前付きクエリの結果が、Indexに載るvariantだけに絞られること。`select: "projection"` の型がスロットの射影に応じて変わること
- キーのエンコーディング：エンコードして逆算すると元の値に戻ること、値の組の順序とエンコード後のバイト順が一致すること（property-based test。文字列のエスケープ対象の文字、空文字列、`null`、負の値、小数、非正規化数を含める）。型をまたいだ並び順が null < false < true < 数値 < Date < 文字列 になること、Schemaを使わずに逆算できること
- 年が 0000〜9999 の範囲外の `Date` をキーに書くとエラーになること
- ベクトル検索：`HASH` を構成するフィールドが欠けた場合に型エラーになること。静的なフィルターに存在しないスロット名を指定するとコンパイルエラーになること
- `add` の対象にIndexのキーに使われるフィールドを指定すると、実行時のエラーになること
- 同じエンティティ名を持つ複数のTable定義が、Repositoryの作成時のエラーになること
- 不正なQueryやSubscription Parameterの拒否

## 15.2 Repositoryテスト

- CRUD
- 条件付き書き込み（`where` の各演算、Itemが存在しない場合と条件が成り立たない場合の区別）
- 差分更新：変更していないフィールドが残ること、`ALL_OLD` から組み立てたAfterが保存された内容と一致すること
- Indexのキーのフィールドを変更したときの物理キーの付け直しと、`undefined` にしたときのIndexからの除外
- 原子的な加算：同時に加算しても値が失われないこと、Afterの値
- `immutable` のフィールドの変更の拒否
- トランザクション：`runTransaction` で読んだItemが変わった場合のやり直し、`createBatch` での競合時の再試行、`where` / `check` が成り立たない場合に再試行せずエラーになること、同じItemへの重複した操作の拒否、100件を超える場合の拒否
- 名前付きクエリとPagination
- 射影ごとの読み方（`KEYS_ONLY` / `INCLUDE` からのBatchGetItem、`UnprocessedKeys` の再試行、`matches` による再判定）
- sparse index（variantにないフィールド、`undefined`）と、`null` がIndexに載ること
- 読み取り結果に物理キーとライブラリ管理属性が現れないこと（`z.strictObject` のitemを含む）
- エンコード後の長さの上限を超えるキーの拒否
- ベクトル検索：次元数がスロットと合わないembeddingベクトルの拒否、`HASH` やフィルターのフィールドが `undefined` のときに属性を書かないこと、書き込み時と検索時で動的なフィルターの値が一致すること、`select: "full"` での本体の取得
- 一括での書き込み（BatchWriteItemの未処理Itemの再試行を含む）
- 読み取るフィールドの指定（`pick` / `omit`、キーが常に含まれること、結果の型）
- Item不存在時の挙動
- Before / Afterの正確さ（トランザクションを含む）
- 作成時のマージ結果がitemとして不正な場合の拒否と、部分更新・ミューテーションで変更するフィールドが不正な場合の拒否
- 部分更新でキーを変更できないこと
- Schema変更後の既存データの読み取り

## 15.3 Protocolテスト

- ClientとServerで、同じ登録簿を利用できること。1つの共有コードを、ブラウザの API とサーバーの API の両方で動かせること（`SharedApi`）
- リクエストとレスポンスの往復（`Date`、`bigint`、`Set`、`Map` を含む値の変換）
- エラーコードとHTTPステータスの対応（§7.5）。Itemがない場合と `where` が成り立たない場合が、同じ `NOT_FOUND` になること
- 不正な入力の拒否（`issues` の内容を含む）
- `authorize` のない操作にパスやリアルタイムを付けられないこと。`false` を返したときに `FORBIDDEN` になること。上書きの `authorize` が効くこと
- `input` で読み出し方を差し替えたときも、Schemaで検証されること
- パスにパラメーターを含むエンドポイントを、Clientが正しく組み立てること
- ページネーショントークンの改ざん・別クエリへの流用の拒否
- `ifUnchanged` のトークンの往復と、不一致のときの `CONFLICT`
- Subscriptionメッセージの検証

## 15.4 Realtimeテスト

- ADDED / MODIFIED / REMOVEDの判定
- 名前付きクエリの所属判定とDynamoDBのQuery結果の一致
- トピックの導出（§9.3）：購読のパラメーターから求めたトピックと、Itemから求めたトピックが一致すること（Sort Keyの等値の部分の長さごと）
- 範囲の購読で、範囲外の変更がGatewayで落とされること。範囲の条件だけが変わったときの `ADDED` / `REMOVED`
- `status` などトピックが変わる更新で、変更前のトピックに `REMOVED`、変更後のトピックに `ADDED` が届くこと
- `fields` による絞り込みが、イベントとSnapshotの両方に効くこと
- 購読の認可（`authorize` が `false` のときに購読できないこと）
- 1本の接続での複数の購読と解除
- 重複イベント
- イベントの順序入れ替わり
- Snapshot取得中の変更
- GSIの遅れによる古いSnapshotとTombstone
- 接続断と再接続
- Publish失敗
- 一括での書き込みの開始・終了イベントと、個々のイベントの書き込み元ID

---

# 16. 設計上の未決事項

各項目の背景、選択肢、推奨の理由は、別ファイルの未決事項の一覧（open-questions.md、open-questions-phase2.md）にまとめている。2026-11-04 までに、すべての項目を決めて本文に反映した。

## 16.1 実装時に詰める細部

設計の判断は残っていない。次の細部は、各Phaseの実装で決める。

- 公開する関数の名前（`defineContext`、`createOps`、`defineEndpoints`、`createServerApi`、`router`、`createClient`、`createRealtimeGateway` など）。登録簿方式への修正（docs/plans/api-redesign.md）で決まった
- Gatewayとクライアントの間のメッセージの形式：§10.5 で決まった
- トピックの文字列を、MQTTの命名の制約に合わせて変換する方式：§9.3 でハッシュにした

**既知の制約**

- zodapp の `zod-transport-json`（`zod-transform`）は、intersection の左右を別々に変換して浅くマージするため、右側が素通しした値で左側の変換結果が上書きされる。zodapp で直るまで、`zod-dynamodb` が transport を作る前に intersection を平らな object（片方が union なら、選択肢ごとに平らにした union）に直して回避している

## 16.2 決定済みの項目（参照）

- 予約名は `_version` とする（§5.5）。名前を変えられる設定は、必要になったときに足す
- Repository：全体置換 `set`、`_version` の条件、`where` の形とエラーの区別、深いマージ、`ifUnchanged`、variantの切り替え（§6.4）
- 共有の定義と、サーバーだけの上書き（§5.8）
- HTTP：登録簿、パスとHTTPメソッドはアプリケーションが決める（§7.2）。値の変換は `zod-transport-json`（§7.4）。エラーの形とコード（§7.5）
- Express：登録簿から作る router、`authorize` は同期で `boolean` を返す（上書きも同じ）、`handle()` と `input` による個別の登録（§8）
- Client：登録簿から作るブラウザの API（fetchのラッパー）と `can`。hooksは `zod-dynamodb-react`（§7.8）
- リアルタイム配送：MQTTだけを開発の対象とする（§9.4）。配送基盤への直接接続はサポートしない（§9.5）。Streams方式は仮定の代替案とする（§11.4）。イベントの本体はフィールドの絞り込みで調整する（§9.4）
- Subscription：名前付きクエリの購読とし、トピックはクエリの定義から作る。範囲の条件はGatewayが判定する（§9.2、§9.3）
- Gateway：フレームワーク非依存の中核と、`http.Server` への取り付け。WebSocketの口は1つ（§9.6）
- 整合性：Tombstoneは購読している間ずっと保持する（§10.2）。トピック単位の連番による欠落検出、変更履歴のReplay、`limit` 付き購読は、MVPでは扱わない（§9.2、§10.4）
- CDK：サンプルアプリケーションとして提供する（§12）
- zod-firebaseとの共通化：zod-dynamodbのPhase 2〜3を先に作り、Phase 3が終わった時点で、実物を見てから共通化を判断する

---

# 17. 推奨する実装順序

## Phase 1：共通定義とRepository

最初にTable定義、名前付きクエリ・ミューテーション、ベクトル検索、DynamoDB Repositoryを実装する。

この段階で、型安全なCRUDと名前付きクエリ、名前付きの検索（ベクトル検索）、差分更新と条件付き書き込みを利用できる状態を目指す。

## Phase 2：コントラクトの分離、通信プロトコル、認可、Express

（Phase 2〜4 で作ったコントラクトと実装の分離は、その後、共有の定義と登録簿の形に改めた。§5.8、§7.2、docs/plans/api-redesign.md）

最初に、Phase 1の定義をコントラクトと実装に分ける。Repositoryは実装を受け取って作るように変える。

次に、エンドポイントのコントラクト（§7.2）、値の変換（§7.4）、エラー（§7.5）を `zod-dynamodb` に実装し、Expressのミドルウェア（§8）を実装する。

認証はアプリケーションに委ね、公開する操作の登録と操作ごとの認可を組み込む。WAFを前提としたバックエンド経由のアクセス方式を、実際に動作する形で検証する。

## Phase 3：Frontend Client

エンドポイントのコントラクトを利用する型安全なHTTP Clientを提供する（§7.8）。

フロントエンドはDynamoDBの認証情報を持たず、バックエンドAPIだけを操作する。

Reactのhooks（`zod-dynamodb-react`）は、必要に応じてこの段階で取得とフォームの部分を作り、購読の部分はPhase 4で足す。

## Phase 4：リアルタイム配信

Subscriptionの定義、トピックの導出、Change Event、Snapshot、再同期の処理を実装する。

Realtime Gateway（`zod-dynamodb-realtime`）と、MQTTを利用した配送（`zod-dynamodb-mqtt`）を追加する。

この段階では、§10.4の保証範囲を実装とテストで確認する。

## Phase 5：サンプルアプリケーションとCDK

`apps/` に、End-to-Endで動くサンプルアプリケーションと、そのCDKのスタック（§12）を用意する。

必要に応じて、デプロイ例、監視設定などを整備する。

上記は推奨順序であり、Express、Frontend Client、RealtimeのどれをMVPとして優先するかは、実装負荷と検証目的に応じて調整する。

---

# 18. まとめ

`zod-dynamodb` は、既存の `zod-firebase` と設計思想を共有しながら、DynamoDBをバックエンド経由で型安全に利用するためのライブラリ群として開発する。

`zod-firebase` が持つ「階層パスをテーブルとして扱う」ための仕組みは持ち込まず、DynamoDBのテーブルをそのままフラットに扱う。一方で、データを任意の数のフィールドで指定し、DB固有の情報を隠して一つのオブジェクトとして読み書きするという、外から見た特徴は維持する。物理キーの属性名やエンコーディングは、単一テーブルの物理レイアウトとしてライブラリの内側に閉じ込める。

中心となるのは、次の4要素である。

1. **Zodに基づく共通Table定義**（キーを含むitemとcreateの個別指定、公開Schemaを組み替えないこと、名前付きクエリ・ミューテーション）
2. **DynamoDBを操作するバックエンドRepository**（キーの注入・マージ・検証などのデータ変換、差分更新と条件付き書き込み、正確なBefore / After）
3. **フロントエンドとバックエンドの共通通信プロトコル**
4. **公開する操作の明示的な列挙と、操作ごとの認可**

加えて、エンドポイントごとのExpressミドルウェアを提供することで、アプリケーションの既存バックエンドに簡単に組み込める構成を目指す。

アプリケーションが認証、認可ポリシー、WAF、サーバー運用を管理し、ライブラリはプロトコル処理と型安全なデータアクセスを担当する。

リアルタイム同期については、MQTTを配送基盤として開発し、配送はインターフェースで分けて、特定の配送基盤をライブラリ全体の前提にはしない。Subscriptionは名前付きクエリの購読として定義し、Snapshot、変更通知、再接続、順序、欠落、整合性については、共通プロトコルとして意味と保証範囲を明確に定義する。

**最終的な目標は、DynamoDBを単に型安全に操作できるようにすることではない。WAFを含む多重防御を前提としたアクセス経路の上で、ZodのTable定義をフロントエンドからバックエンド、インフラ、リアルタイム同期まで一貫して活用できるエコシステムを実現することである。**

---

# 付録A. 名称の経緯（Burmaculex）

当初は、DynamoDBベースのリアルタイムDocument Databaseエコシステムを `Burmaculex` という独立名称で構想していた。

しかし、次の理由から `zod-dynamodb` を中心とした命名のほうが自然になってきた。

- 既存の `zod-firebase` との関係が明確になる
- `zod-dynamodb-express` や `zod-dynamodb-cdk` まで含めれば、単なるRepositoryライブラリに限定されない
- FirebaseとDynamoDBで共通するアーキテクチャを育てやすい
- OSSの利用者が、パッケージ名から対応するデータベースと用途を理解しやすい

現時点では `zod-dynamodb-*` を第一候補とするが、最終的な名称とBurmaculexという名称の扱いは未確定とする。
