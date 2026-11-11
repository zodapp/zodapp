# zodapp

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

**AIネイティブなスキーマ駆動開発フレームワーク**

zodappは、Zodスキーマを利用して、型安全なアプリケーション開発を支援するフレームワークです。
Zodスキーマにメタデータを付与することで、フォームUIや表形式UI、DynamoDB との連携を自動生成します。

従来のように、DBスキーマ / APIスキーマ / UIスキーマを別々に管理するのではなく、
1つのスキーマから、型定義 / フォームUI / DB との連携を作るため、
AI開発の効率を最大限に高めるとともに、AIコーディングの結果を人間がレビューするのを格段に容易にします。

AIコーディングの時代にもっとも適した、AIネイティブな開発フレームワークです。

## コンセプト

### 1. スキーマファースト開発

従来の開発では、型定義、バリデーション、フォーム、データベーススキーマを個別に管理する必要がありました。zodappでは**Zodスキーマを単一の情報源（Single Source of Truth）**として、すべてを自動生成します。

```typescript
// スキーマを一度定義するだけ
const userSchema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
    email: zf
      .string()
      .email()
      .register(zf.string.registry, { label: "メール" }),
    age: zf.number().min(0).register(zf.number.registry, { label: "年齢" }),
  })
  .register(zf.object.registry, {});

// 型定義は自動推論
type User = z.infer<typeof userSchema>;

// フォームUIは自動生成
<Dynamic fieldPath="" schema={userSchema} />

// DynamoDB との連携も型安全（キーと Index のフィールドは定義時に検査される）
const users = tableConfig({
  table: appTable,
  entity: "User",
  item: userSchema.extend({ userId: z.string() }),
  create: userSchema,
  key: { partition: ["userId"] },
});
```

### 2. メタデータ拡張システム

Zod 4で導入されたregistry機能を利用して、Zodスキーマに**ラベル、表示オプション**などのメタデータを付与できます。これにより、スキーマがデータ構造だけでなくUI情報も持つようになります。

```typescript
// メタデータ付きスキーマ
const schema = z
  .object({
    password: zf.string().register(zf.string.registry, {
      label: "パスワード",
      uiType: "password", // パスワード入力として表示
    }),
    role: zf
      .enum([
        zf.literal("admin").register(zf.literal.registry, { label: "管理者" }),
        zf.literal("user").register(zf.literal.registry, { label: "一般ユーザー" }),
      ])
      .register(zf.enum.registry, { label: "ロール" }),
  })
  .register(zf.object.registry, {});
```

### 3. 型安全な DynamoDB 連携

Table 定義（`tableConfig`）と名前付きの操作（`createOps`）を、ブラウザとサーバーで共有します。
操作の認可（`authorize`）も同じ定義に書くので、ブラウザは送る前に同じ判定ができ（`can`）、サーバーは必ずそれを通します。
公開する操作の登録簿（`defineEndpoints`）から、ブラウザの API、Express の router、リアルタイムの購読（`live`）が作られます。

```typescript
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({ workspaceId: z.string(), status: taskStatusSchema }),
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId, status: p.status } }),
  }),
}));

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.byStatus, path: "/tasks/by-status", live: true },
  ],
});

// ブラウザ：型付きの API と、リアルタイムの一覧
const api = createClient(endpoints, { baseUrl: "/api" });
const useTasks = createUseList(api.tasks.byStatus, { live: true });
```

設計は [docs/zod-dynamodb/design.md](docs/zod-dynamodb/design.md) にあります。

### 4. アーキテクチャ非依存のモジュラー設計

zodappは特定のアーキテクチャに縛られない、柔軟なモジュラー設計を採用しています。

**API層を省略したシンプルな構成との相性が抜群**

API層を省略し、DBのドキュメント構造とUIフォームの構造を一致させる設計（ユニファイドスキーマアーキテクチャ）では、スキーマを定義するだけで、フォームUI・バリデーション・データベース連携が自動生成されるため、**ほぼコードを書くことなく**安全なアプリケーションを構築できます。

通常、DBのドキュメント構造とUIフォームの構造を一致させる設計にすると、パフォーマンスに問題がおきがちですが、zodappは独自のキャッシング機構でこの問題を解決しました。サーバサイド/クライアントサイドでテーブルジョインを行わなくても、ネットワーク負荷の少ない高効率な外部キー参照が可能です。

**アーキテクチャフリー**

一方、従来のDBスキーマ・APIスキーマ・UIスキーマを分離した構成でも、各層でzodappのモジュールを100%活用できます(APIスキーマは持たないため、ts-restなどの利用を推奨)。このため、ユニファイドスキーマアーキテクチャで開発を開始してから、通常アーキテクチャに変更、あるいは逆の設計変更をすることが容易です。開発段階での技術選択コストを低減します。

## パッケージ構成

### スキーマとフォーム（DB に依存しない）

| パッケージ | 説明 |
| --- | --- |
| [`@zodapp/zod-form`](packages/zod-form/README.ja.md) | React非依存のスキーマ拡張（`zf`） |
| [`@zodapp/zod-form-react`](packages/zod-form-react/README.ja.md) | React基盤（`Dynamic` / hooks / `zfReact`） |
| [`@zodapp/zod-form-mantine`](packages/zod-form-mantine/README.ja.md) | Mantine UIの componentLibrary / tableComponentLibrary |
| `@zodapp/zod-form-mantine-lite` | TanStack Form に依存しない Mantine のコンポーネント |
| `@zodapp/zod-tabular` | Zod スキーマと表形式データ（2 次元配列。CSV / Excel 向け）の相互変換 |
| [`@zodapp/zod-extendable`](packages/zod-extendable/README.ja.md) | Zodにメタデータを付与する拡張機能（zfの土台） |
| [`@zodapp/zod-propagating-registry`](packages/zod-propagating-registry/README.ja.md) | Zod v4 registry の薄いラッパー |
| [`@zodapp/zod-searchparams`](packages/zod-searchparams/README.ja.md) | URLSearchParams と複雑な型（Date/Set/Map等）の相互変換 |
| [`@zodapp/zod-transform`](packages/zod-transform/README.ja.md) | Zodスキーマをベースにした値変換（preprocess/postprocess） |
| `@zodapp/zod-transport-json` | Zod スキーマに沿った JSON の送受信（Date などを戻す） |
| [`@zodapp/caching-utilities`](packages/caching-utilities/README.ja.md) | subscription共有などのキャッシュユーティリティ |
| `@zodapp/react-storage` | ブラウザのストレージに保存する React の state |

### DynamoDB

| パッケージ | 説明 |
| --- | --- |
| [`@zodapp/zod-dynamodb`](packages/zod-dynamodb/README.ja.md) | Table 定義、キーのエンコーディング、名前付きの操作、登録簿（ブラウザとサーバーで共有） |
| [`@zodapp/zod-dynamodb-node`](packages/zod-dynamodb-node/README.ja.md) | DynamoDB の Repository（サーバー） |
| [`@zodapp/zod-dynamodb-express`](packages/zod-dynamodb-express/README.ja.md) | 登録簿を配信する Express の router |
| [`@zodapp/zod-dynamodb-client`](packages/zod-dynamodb-client/README.ja.md) | 登録簿から作る型付きの HTTP / リアルタイムの Client |
| [`@zodapp/zod-dynamodb-react`](packages/zod-dynamodb-react/README.ja.md) | 一覧と Item の React の hooks |
| [`@zodapp/zod-dynamodb-realtime`](packages/zod-dynamodb-realtime/README.ja.md) | リアルタイムの購読を配る WebSocket の Gateway |
| [`@zodapp/zod-dynamodb-mqtt`](packages/zod-dynamodb-mqtt/README.ja.md) | 変更の発行と購読の MQTT の transport（ローカルは aedes、本番は IoT Core など） |

### フォームの Resolver（外部キーとファイル）

| パッケージ | 説明 |
| --- | --- |
| [`@zodapp/zod-form-dynamodb`](packages/zod-form-dynamodb/README.ja.md) | 外部キーの選択肢を、登録簿の名前付きクエリから読む |
| [`@zodapp/zod-form-s3`](packages/zod-form-s3/README.ja.md) | ファイルを、サーバーが発行した署名付き URL で S3 に直接アップロードする（ブラウザ） |
| [`@zodapp/zod-form-s3-node`](packages/zod-form-s3-node/README.ja.md) | 署名付き URL を発行する、認可つきの Express の router（サーバー） |

## サンプル

| アプリ | 内容 |
| --- | --- |
| [`apps/form-demo`](apps/form-demo/README.ja.md) | フォームと表のカタログ。DB に依存しない（GitHub Pages で公開） |
| [`apps/taskmanager`](apps/taskmanager/README.md) | タスク管理。DynamoDB・Cognito・S3・リアルタイムの一覧を、ブラウザからデータベースまで通して動かす |
| [`apps/survey`](apps/survey/README.md) | アンケート。質問をデータとして保存し、実行時にフォームと表のスキーマを組み立てる |

DB を使うサンプルは、DynamoDB Local・Cognito のエミュレーター（magnito）などを Docker で動かします。手順は各アプリの README にあります。

Firebase（Firestore）版のパッケージとデモは、タグ `firebase-final` の時点に残っています。

## 技術スタック

- **言語**: TypeScript 5.x
- **バリデーション**: Zod 4
- **フロントエンド**: React 19 + Vite 7
- **ルーティング**: TanStack Router
- **フォーム**: TanStack Form + zod-form
- **UI**: Mantine UI
- **バックエンド**: DynamoDB（zod-dynamodb）、Express
- **認証（サンプル）**: Cognito（ローカルは magnito）
- **ビルド**: Turborepo (monorepo)
- **テスト**: Vitest

## 開発を始める

```bash
# 依存関係のインストール
pnpm install

# フォームのデモ（DB 不要）
pnpm --filter form-demo dev

# テストの実行（zod-dynamodb 系のテストは DynamoDB Local を使う）
pnpm dynamodb:start
pnpm test
pnpm dynamodb:stop

# ビルド
pnpm build
```

## ライセンス

MIT
