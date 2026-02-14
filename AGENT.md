# AGENT.md

このファイルはAIエージェントがプロジェクトを理解し、適切にコード生成・修正を行うためのガイドラインです。

## コンセプト

プロジェクトのコンセプトと全体像は **[README.ja.md](README.ja.md)** を参照してください。

## コード修正時の必須チェック

コードを修正した場合は、**必ず以下のコマンドを実行して**エラーがないことを確認してください：

```bash
pnpm check-types  # 型チェック
pnpm build        # 全パッケージビルド
```

## 技術スタック

| カテゴリ               | 技術                                  |
| ---------------------- | ------------------------------------- |
| パッケージマネージャー | pnpm 10.9.0                           |
| Node.js                | 22.14.0 (Volta固定)                   |
| フロントエンド         | React 19 + Vite 7                     |
| ルーティング           | TanStack Router                       |
| フォーム               | TanStack Form + @zodapp/zod-form-mantine |
| バリデーション         | Zod 4                                 |
| UI                     | Mantine UI                            |
| バックエンド           | Firebase (Firestore)                  |
| テスト                 | Vitest                                |
| Lint/Format            | ESLint + Prettier                     |

## プロジェクト構造

```
zodapp/
├── apps/
│   ├── web/          # メインWebアプリ (TanStack Router)
│   └── docs/         # ドキュメントアプリ (React Router)
├── packages/
│   ├── zod-form/              # フォーム自動生成のコア（zf拡張定義）
│   ├── zod-form-mantine/      # Mantine UIコンポーネントライブラリ
│   ├── zod-form-firebase/     # Firebase連携用resolver
│   ├── zod-firebase/          # Firebase統合 (コア型定義)
│   ├── zod-firebase-browser/  # ブラウザ用Firebase実装
│   ├── zod-firebase-node/     # Node.js用Firebase実装
│   ├── zod-extendable/        # Zodメタデータ拡張機能
│   ├── zod-propagating-registry/ # Zodレジストリ拡張
│   ├── zod-searchparams/      # URLパラメータ用変換
│   ├── zod-transform/         # Zodスキーマ変換ユーティリティ
│   ├── ui/                    # 共有UIコンポーネント
│   ├── firebase/              # Firebase設定
│   ├── eslint-config/         # ESLint設定
│   └── typescript-config/     # TypeScript設定
├── turbo.json        # Turborepo設定
├── pnpm-workspace.yaml
└── vitest.config.ts
```

## 開発コマンド

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # 全パッケージビルド
pnpm test         # テスト実行
pnpm lint         # リント実行
pnpm format       # コードフォーマット
pnpm check-types  # 型チェック
```

## コーディング規約

### Zodスキーマ駆動開発

- 型定義はZodスキーマから生成する (`z.infer<typeof schema>`)
- フォームは `@zodapp/zod-form` の `zf` 拡張を使用する
- スキーマに `register()` でメタデータ（label, uiType等）を付与する

```typescript
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
    age: zf
      .number()
      .min(0)
      .max(150)
      .register(zf.number.registry, { label: "年齢" }),
    frequency: zf
      .number()
      .min(0)
      .max(7)
      .register(zf.number.registry, { label: "週の回数", uiType: "slider" }),
    birthday: zf.date().register(zf.date.registry, { label: "誕生日" }),
    isMember: zf.boolean().register(zf.boolean.registry, { label: "会員" }),
  })
  .register(zf.object.registry, {});

type SchemaType = z.infer<typeof schema>;
```

### zf拡張の主要な型

| 型                 | 説明                           |
| ------------------ | ------------------------------ |
| `zf.string()`      | 文字列入力                     |
| `zf.number()`      | 数値入力                       |
| `zf.boolean()`     | チェックボックス               |
| `zf.date()`        | 日付入力                       |
| `zf.bigint()`      | BigInt入力                     |
| `zf.literal()`     | リテラル値                     |
| `zf.enum()`        | 列挙型（セレクト）             |
| `zf.array()`       | 配列                           |
| `zf.tuple()`       | タプル                         |
| `zf.object()`      | オブジェクト                   |
| `zf.union()`       | ユニオン型（判別器付き）       |
| `zf.externalKey()` | 外部キー参照                   |
| `zf.file()`        | ファイルアップロード           |
| `zf.message()`     | メッセージ表示（入力なし）     |
| `zf.computed()`    | 計算フィールド（表示のみ）     |
| `zf.hidden()`      | 非表示フィールド               |

### コンポーネント

- 関数コンポーネント + React Hooksを使用
- `export const ComponentName = () => { ... }` 形式でエクスポート
- Mantine UIコンポーネントを優先使用

```typescript
// 良い例
export const MyComponent = ({ title }: Props) => {
  const [value, setValue] = useState("");
  return <TextInput label={title} value={value} onChange={(e) => setValue(e.target.value)} />;
};
```

### ルーティング

- TanStack Routerの**コードベースルーティング**を使用（ファイルベースルーティングは使用していない）
- `router.tsx`でルートツリーを手動で構築
- クエリパラメータは `@zodapp/zod-searchparams` と Zod スキーマで検証・変換

#### ファイル命名規則

| ファイル名          | 役割                                              |
| ------------------- | ------------------------------------------------- |
| `*.route.ts`        | ルート定義（`createRoute`の呼び出し）             |
| `*.tsx`             | コンポーネント（`lazyRouteComponent`で遅延読み込み） |
| `Layout.tsx`        | レイアウトコンポーネント                          |
| `layout.route.ts`   | レイアウトルートの定義                            |

#### ルートツリーの構築

ルートツリーは `router.tsx` で手動で構築する：

```typescript
// router.tsx
const routeTree = rootRoute.addChildren([
  topRoute.addChildren([homeRoute]),
  formRoute.addChildren([formListRoute, formDetailRoute]),
  taskManagerRoute.addChildren([
    topLayoutRoute.addChildren([workspacesRoute]),
    workspaceLayoutRoute.addChildren([
      workspaceDetailRoute,
      projectsRoute,
    ]),
  ]),
]);
```

#### ルート定義例

```typescript
// detail.route.ts
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { formRoute } from "./index.route";

const searchSchema = z.object({
  formId: z.string().optional(),
});

export const formDetailRoute = createRoute({
  getParentRoute: () => formRoute,  // 親ルートを指定
  path: "detail",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./detail")),  // 同名の.tsxを読み込み
});
```

#### zod-searchparams との統合

URL検索パラメータの処理は以下の役割分担で行う：

| 処理       | 設定場所                            | 関数                               | スキーマ |
| ---------- | ----------------------------------- | ---------------------------------- | -------- |
| エンコード | `createRouter` の `stringifySearch` | `encodeSearchParams(obj)`          | 不要     |
| パース     | `createRouter` の `parseSearch`     | `searchParamsToParamsTree(params)` | 不要     |
| 型変換     | 各ルートの `validateSearch`         | `fromParamsTree(tree, schema)`     | 必要     |

これにより Date, Set, Map などの複雑な型を URL パラメータとして扱える。

#### ナビゲーション

`navigate` や `Link` では Date などをそのまま渡せる（自動エンコード）：

```typescript
navigate({
  search: {
    dueAt: { $gte: new Date("2025-01-01"), $lte: new Date("2025-12-31") },
  },
});
```

### スタイリング

優先順位: Mantine UI > CSS Modules > インラインスタイル

```typescript
// Mantine UIを優先
<Button variant="filled" color="blue">Submit</Button>

// ページ固有のスタイルはCSS Modules
import styles from "./page.module.css";
<div className={styles.container}>
```

## 重要なパターン

### フォーム作成パターン

```typescript
import { z } from "zod";
import { Button, Stack } from "@mantine/core";
import {
  componentLibrary,
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-mantine";
import { zf } from "@zodapp/zod-form";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
  })
  .register(zf.object.registry, {});

export const MyForm = () => {
  const form = useZodForm({
    defaultValues: { name: "" },
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      console.log(value);
    },
  });

  return (
    <ZodFormContextProvider componentLibrary={componentLibrary}>
      <FormProvider form={form}>
        <ValidatePrecedingFieldsProvider>
          <Stack gap="md">
            <Dynamic fieldPath="" schema={schema} />
            <Button onClick={() => form.handleSubmit()}>送信</Button>
          </Stack>
        </ValidatePrecedingFieldsProvider>
      </FormProvider>
    </ZodFormContextProvider>
  );
};
```

### Firebase連携パターン

```typescript
import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";

const taskSchema = z.object({
  title: z.string(),
  dueDate: z.date().optional(),
  completed: z.boolean(),
});

// コレクション定義（パスパラメータは型推論される）
const taskConfig = collectionConfig({
  path: "workspaces/:workspaceId/projects/:projectId",
  extraIdentityKeys: ["taskId"],
  dataSchema: taskSchema,
});

// パスの生成（型安全）
taskConfig.getPath({ workspaceId: "ws1", projectId: "p1", taskId: "t1" });
// → "workspaces/ws1/projects/p1/tasks/t1"
```

## テストガイドライン

- テストファイルは `*.spec.ts` または `*.test.ts`
- Vitestを使用（globals: true設定済み）
- Reactコンポーネントは `@testing-library/react` を使用

```typescript
// example.spec.ts
import { describe, it, expect } from "vitest";

describe("myFunction", () => {
  it("should return expected value", () => {
    expect(myFunction()).toBe(expected);
  });
});
```

## 新規パッケージ追加

1. `packages/` に新規ディレクトリを作成
2. `package.json` を作成（`name` と `exports` を正しく設定）
3. 既存パッケージから `eslint.config.mjs` と `tsconfig.json` をコピー
   - JSX使用時: `@repo/eslint-config/react-internal`, `@repo/typescript-config/react-library.json`
   - JSX不使用時: `@repo/eslint-config/base`, `@repo/typescript-config/base.json`
4. ルートで `pnpm install` を実行

詳細は [GUIDE_TO_TURBOREPO.md](GUIDE_TO_TURBOREPO.md) を参照。

## その他の注意事項

- 日本語のエラーメッセージは `apps/web/src/components/zod-errormap.ja.ts` で定義
- Firebase統合時は `@zodapp/zod-firebase` 系パッケージを使用
- ファイルアップロードには `@zodapp/zod-form-firebase` の `createFirebaseStorageResolver` を使用
- 未実装機能のリストは [TODO.md](TODO.md) を参照
- コードフォーマットは `tabWidth: 2`, `useTabs: false`（Prettier設定）
- プロジェクトの詳細なコンセプトは [README.ja.md](README.ja.md) を参照
