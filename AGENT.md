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

| カテゴリ               | 技術                                     |
| ---------------------- | ---------------------------------------- |
| パッケージマネージャー | pnpm 10.9.0                              |
| Node.js                | 22.22.2 (Volta固定)                      |
| フロントエンド         | React 19 + Vite 7                        |
| ルーティング           | TanStack Router                          |
| フォーム               | TanStack Form + @zodapp/zod-form-mantine |
| バリデーション         | Zod 4                                    |
| UI                     | Mantine UI                               |
| バックエンド           | DynamoDB（@zodapp/zod-dynamodb）+ Express |
| テスト                 | Vitest                                   |
| Lint/Format            | ESLint + Prettier                        |

## プロジェクト構造

```
zodapp/
├── apps/
│   ├── form-demo/    # フォームと表のカタログ（DB 非依存、GitHub Pages）
│   ├── taskmanager/  # タスク管理のサンプル（DynamoDB・Cognito・S3・リアルタイム）
│   └── survey/       # アンケートのサンプル（質問をデータとして持ち、実行時にスキーマを組み立てる）
├── packages/
│   ├── zod-form/                 # フォーム自動生成のコア（zf拡張定義）
│   ├── zod-form-react/           # React基盤（Dynamic / hooks / zfReact）
│   ├── zod-form-mantine/         # Mantine UIコンポーネントライブラリ
│   ├── zod-form-mantine-lite/    # TanStack Form に依存しない Mantine コンポーネント
│   ├── zod-form-widget/          # AutoForm / AutoTable などのウィジェット（private）
│   ├── zod-form-dynamodb/        # 外部キーの Resolver（登録簿の名前付きクエリ）
│   ├── zod-form-s3/              # ファイルの Resolver（S3 の署名付き URL、ブラウザ）
│   ├── zod-form-s3-node/         # 署名付き URL を発行する Express の router（サーバー）
│   ├── zod-dynamodb/             # Table 定義・操作・認可・登録簿（ブラウザとサーバーで共有）
│   ├── zod-dynamodb-node/        # DynamoDB の Repository
│   ├── zod-dynamodb-express/     # 登録簿を配信する Express の router
│   ├── zod-dynamodb-client/      # 型付きの HTTP / リアルタイムの Client
│   ├── zod-dynamodb-react/       # 一覧と Item の hooks
│   ├── zod-dynamodb-realtime/    # リアルタイムの購読の WebSocket Gateway
│   ├── zod-dynamodb-mqtt/        # 変更の発行と購読の MQTT transport
│   ├── zod-transport-json/       # スキーマに沿った JSON の送受信
│   ├── zod-tabular/              # スキーマと表形式データの相互変換
│   ├── zod-extendable/           # Zodメタデータ拡張機能
│   ├── zod-propagating-registry/ # Zodレジストリ拡張
│   ├── zod-searchparams/         # URLパラメータ用変換
│   ├── zod-transform/            # Zodスキーマ変換ユーティリティ
│   ├── caching-utilities/        # 購読の共有などのキャッシュ
│   ├── react-storage/            # ブラウザのストレージに保存する state
│   ├── eslint-config/            # ESLint設定
│   └── typescript-config/        # TypeScript設定
├── docs/zod-dynamodb/  # zod-dynamodb の設計
├── turbo.json          # Turborepo設定
├── pnpm-workspace.yaml
└── vitest.config.ts
```

各アプリの詳細は、それぞれの README（`apps/form-demo` は AGENT.md も）を参照してください。

## 開発コマンド

```bash
pnpm --filter form-demo dev  # フォームのデモ（DB 不要）
pnpm build        # 全パッケージビルド
pnpm test         # テスト実行（zod-dynamodb 系とサンプルのテストは DynamoDB Local を使う。pnpm dynamodb:start で起動）
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

| 型                 | 説明                       |
| ------------------ | -------------------------- |
| `zf.string()`      | 文字列入力                 |
| `zf.number()`      | 数値入力                   |
| `zf.boolean()`     | チェックボックス           |
| `zf.date()`        | 日付入力                   |
| `zf.bigint()`      | BigInt入力                 |
| `zf.literal()`     | リテラル値                 |
| `zf.enum()`        | 列挙型（セレクト）         |
| `zf.array()`       | 配列                       |
| `zf.tuple()`       | タプル                     |
| `zf.object()`      | オブジェクト               |
| `zf.union()`       | ユニオン型（判別器付き）   |
| `zf.externalKey()` | 外部キー参照               |
| `zf.file()`        | ファイルアップロード       |
| `zf.message()`     | メッセージ表示（入力なし） |
| `zf.computed()`    | 計算フィールド（表示のみ） |
| `zf.hidden()`      | 非表示フィールド           |

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

| ファイル名        | 役割                                                 |
| ----------------- | ---------------------------------------------------- |
| `*.route.ts`      | ルート定義（`createRoute`の呼び出し）                |
| `*.tsx`           | コンポーネント（`lazyRouteComponent`で遅延読み込み） |
| `Layout.tsx`      | レイアウトコンポーネント                             |
| `layout.route.ts` | レイアウトルートの定義                               |

#### ルートツリーの構築

ルートツリーは `router.tsx` で手動で構築する：

```typescript
// router.tsx
const routeTree = rootRoute.addChildren([
  topRoute.addChildren([homeRoute]),
  formRoute.addChildren([formListRoute, formDetailRoute]),
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
  getParentRoute: () => formRoute, // 親ルートを指定
  path: "detail",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./detail")), // 同名の.tsxを読み込み
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

### DynamoDB 連携パターン

Table 定義と操作は、ブラウザとサーバーで共有するファイル（サンプルでは `src/shared/`）に書く。
認可（`authorize`）も同じ定義に書き、ブラウザは `can` で同じ判定をする。

```typescript
import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";

export const tasks = tableConfig({
  table: appTable, // physicalTable() で作る単一テーブル
  entity: "Task",
  item: taskSchema,
  create: taskBodySchema,
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: { slot: "GSI1", partition: ["workspaceId", "status"], sort: ["updatedAt"] },
  },
  onCreate: ({ now }) => ({ createdAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});

// defineContext<Auth>() が返す createOps / defineEndpoints を使う
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => isMember(ctx, key.workspaceId) }),
  setStatus: o.mutation({
    params: z.object({ status: taskStatusSchema }),
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
  }),
}));

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
  ],
});
```

- onCreate の戻り値は入力より優先される（`{...input, ...onCreate, ...onWrite, ...key}`）。入力の値を使いたい項目は onCreate で上書きしない
- DynamoDB はキー（Index）でしか絞り込めない。残りの条件は読んだ一覧をブラウザで絞る（サンプルは mingo）
- 詳しくは `docs/zod-dynamodb/design.md` と `packages/zod-dynamodb/README.ja.md`

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

- 日本語のエラーメッセージは `apps/form-demo/src/components/zod-errormap.ja.ts` で定義
- DB との連携は `@zodapp/zod-dynamodb` 系パッケージを使用
- 外部キーの選択肢は `@zodapp/zod-form-dynamodb`、ファイルアップロードは `@zodapp/zod-form-s3`（サーバーは `@zodapp/zod-form-s3-node`）を使用
- Firebase（Firestore）版のパッケージは、タグ `firebase-final` の時点に残っている
- コードフォーマットは `tabWidth: 2`, `useTabs: false`（Prettier設定）
- プロジェクトの詳細なコンセプトは [README.ja.md](README.ja.md) を参照
