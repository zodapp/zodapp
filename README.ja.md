# zodapp

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

**AIネイティブなスキーマ駆動開発フレームワーク**

zodappは、Zodスキーマを利用して、型安全なアプリケーション開発を支援するフレームワークです。
Zodスキーマにメタデータを付与することで、フォームUIや表形式UI、Firebase連携を自動生成します。

従来のように、DBスキーマ / APIスキーマ / UIスキーマを別々に管理するのではなく、
1つのスキーマから、型定義 / フォームUI / Firebase連携を作るため、
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

// Firestoreとの連携も型安全
const usersConfig = collectionConfig({
  path: "users/:userId",
  extraIdentityKeys: [] as const,
  dataSchema: userSchema,
});
usersConfig.buildPath({ userId: "u1" }); // "users/u1"
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

### 3. 型安全なFirebase連携

Firestoreのドキュメントパスとデータ構造を型レベルで管理。パスパラメータの型推論により、タイポや型不一致をコンパイル時に検出できます。

```typescript
// コレクション定義
const taskConfig = collectionConfig({
  path: "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId",
  extraIdentityKeys: [] as const,
  dataSchema: taskSchema,
});

// パスパラメータは型推論される
taskConfig.buildPath({ workspaceId: "ws1", projectId: "p1", taskId: "t1" });
// → "/workspaces/ws1/projects/p1/tasks/t1"
```

### 4. アーキテクチャ非依存のモジュラー設計

zodappは特定のアーキテクチャに縛られない、柔軟なモジュラー設計を採用しています。

**API層を省略したシンプルな構成との相性が抜群**

API層を省略し、DBのドキュメント構造とUIフォームの構造を一致させる設計（ユニファイドスキーマアーキテクチャ）では、スキーマを定義するだけで、フォームUI・バリデーション・データベース連携が自動生成されるため、**ほぼコードを書くことなく**安全なアプリケーションを構築できます。

通常、DBのドキュメント構造とUIフォームの構造を一致させる設計にすると、パフォーマンスに問題がおきがちですが、zodappは独自のキャッシング機構でこの問題を解決しました。サーバサイド/クライアントサイドでテーブルジョインを行わなくても、ネットワーク負荷の少ない高効率な外部キー参照が可能です。

**アーキテクチャフリー**

一方、従来のDBスキーマ・APIスキーマ・UIスキーマを分離した構成でも、各層でzodappのモジュールを100%活用できます(APIスキーマは持たないため、ts-restなどの利用を推奨)。このため、ユニファイドスキーマアーキテクチャで開発を開始してから、通常アーキテクチャに変更、あるいは逆の設計変更をすることが容易です。開発段階での技術選択コストを低減します。

## パッケージ構成

| パッケージ                         | 説明                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| [`@zodapp/zod-form`](packages/zod-form/README.ja.md) | React非依存のスキーマ拡張（`zf`）                                      |
| [`@zodapp/zod-form-react`](packages/zod-form-react/README.ja.md) | React基盤（`Dynamic` / hooks / `zfReact`）                             |
| [`@zodapp/zod-form-mantine`](packages/zod-form-mantine/README.ja.md) | Mantine UIの componentLibrary / tableComponentLibrary                 |
| [`@zodapp/zod-form-firebase`](packages/zod-form-firebase/README.ja.md) | フォーム用 Firestore/Storage resolver                                 |
| [`@zodapp/zod-firebase`](packages/zod-firebase/README.ja.md) | Firestoreコレクション定義（path + Zod schema）と型                    |
| [`@zodapp/zod-firebase-browser`](packages/zod-firebase-browser/README.ja.md) | `firebase/compat` 用 Firestore アクセサ（購読共有・キャッシュ含む）   |
| [`@zodapp/zod-firebase-node`](packages/zod-firebase-node/README.ja.md) | `firebase-admin` 用 Firestore アクセサ                                |
| [`@zodapp/caching-utilities`](packages/caching-utilities/README.ja.md) | subscription共有などのキャッシュユーティリティ                        |
| [`@zodapp/zod-extendable`](packages/zod-extendable/README.ja.md) | Zodにメタデータを付与する拡張機能（zfの土台）                          |
| [`@zodapp/zod-propagating-registry`](packages/zod-propagating-registry/README.ja.md) | Zod v4 registry の薄いラッパー                                        |
| [`@zodapp/zod-searchparams`](packages/zod-searchparams/README.ja.md) | URLSearchParams と複雑な型（Date/Set/Map等）の相互変換                |
| [`@zodapp/zod-transform`](packages/zod-transform/README.ja.md) | Zodスキーマをベースにした値変換（preprocess/postprocess）             |

## 技術スタック

- **言語**: TypeScript 5.x
- **バリデーション**: Zod 4
- **フロントエンド**: React 19 + Vite 7
- **ルーティング**: TanStack Router
- **フォーム**: TanStack Form + zod-form
- **UI**: Mantine UI
- **バックエンド**: Firebase (Firestore)
- **ビルド**: Turborepo (monorepo)
- **テスト**: Vitest

## 開発を始める

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# テストの実行
pnpm test

# ビルド
pnpm build
```

## ライセンス

MIT
