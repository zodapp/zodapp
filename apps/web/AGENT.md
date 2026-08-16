## apps/web — アプリ開発テンプレ（@zodapp/\* サンプル）

`apps/web` は、`@zodapp/*` ファミリを **実アプリに流用するためのテンプレ兼サンプル実装**です。

- **ルーティング**: TanStack Router（コードベースルーティング）
- **UI**: React + Vite + Mantine
- **データ**: Firebase（Firestore / compat）

3 つのデモで構成されています。

| デモ | パス | 主に示すこと |
| --- | --- | --- |
| フォームデモ | `/form` | スキーマ 1 つから生成されるフォーム UI のカタログ |
| アプリデモ（タスク管理） | `/taskManager` | マルチテナント CRUD、一覧・検索・CSV・列設定・権限 |
| アンケートデモ | `/survey` | **ランタイムスキーマ生成**（定義をデータとして保存 → 実行時にスキーマ化）と 2 カラムビルダー |

アンケートデモはタスク管理と**同じワークスペース（テナント）・同じ認証**を共用しており、
「1 つのテナント基盤に複数アプリを載せる」構成の例にもなっています。

参照: `apps/web/README.ja.md`

---

## 最短起動（コピペ用）

```bash
# リポジトリルートで
pnpm install

# Webアプリ起動
pnpm --filter web dev

# 型チェック / ビルド
pnpm --filter web check-types
pnpm --filter web build
```

参照: `package.json`, `apps/web/package.json`, `apps/web/README.ja.md`

---

## 開発前提（バージョン / エイリアス）

- **Node / pnpm**
  - ルート `package.json` で Node は `>=22`（Volta設定あり）
  - package manager は `pnpm`
  - 参照: `package.json`
- **import エイリアス**
  - `@` → `apps/web/src`（Vite alias）
  - 参照: `apps/web/vite.config.ts`

---

## 必須セットアップ（Firebase）

このリポジトリでは `firebaseConfig.json` を **リポジトリルート**に置きます（gitignore 済み）。

- **置く場所**: `<repo-root>/firebaseConfig.json`
- **読む場所**: `packages/firebase/src/index.ts`（`import firebaseConfig from "../../../firebaseConfig.json";`）
- **gitignore**: `.gitignore` に `firebaseConfig.json`
- **アプリ側の利用**: `@repo/firebase` から `firestore` / `auth` / `storage` などを import する
  - 参照: `packages/firebase/src/index.ts`

**エミュレータモード（本番プロジェクト不要）**

`VITE_FIREBASE_EMULATOR=1` を付けて起動すると Firebase Emulator Suite
（auth: 9099 / firestore: 8080 / storage: 9199）に接続します。
`firebaseConfig.json` はダミー値でよく、認証もメール/パスワードで完結します。

```bash
# ターミナル1: エミュレータ起動（リポジトリルート）
pnpm emulator

# ターミナル2: エミュレータ接続でWebアプリ起動
VITE_FIREBASE_EMULATOR=1 pnpm --filter web dev
```

参照: `apps/web/README.ja.md`, `packages/firebase/src/index.ts`, `firebase.json`, `.gitignore`

---

## ディレクトリマップ（どこに何があるか）

- **エントリポイント**
  - `apps/web/src/main.tsx` → `apps/web/src/App.tsx`
- **ルーティング**
  - ルートツリー組み立て: `apps/web/src/pages/router.tsx`
  - ルート定義: `apps/web/src/pages/**/*.route.ts`
  - `src/routes` は使っていない（README参照）
- **共通UI**
  - 共通レイアウト: `apps/web/src/components/CommonLayout.tsx`
  - 自動フォーム: `apps/web/src/components/AutoForm.tsx`
  - 自動テーブル: `apps/web/src/components/AutoTable.tsx`
  - 自動検索フォーム: `apps/web/src/components/AutoSearch.tsx`
  - ページングUI（GrowingList用）: `apps/web/src/components/FetchMore.tsx`
  - クライアント側フィルタ（Mongo風）: `apps/web/src/components/mingoQuery.ts`
- **認証**
  - Context/Hook/Guard: `apps/web/src/shared/auth/*`
- **Firestore（TaskManager例）**
  - コレクション定義: `apps/web/src/shared/taskManager/collections/*.ts`
  - Firestore hooks（firestoreバインド済み）: `apps/web/src/shared/taskManager/hooks/index.ts`
  - 画面例: `apps/web/src/pages/taskManager-*/**/*.tsx`
- **アンケート（Survey例 / ランタイムスキーマ生成）**
  - 質問定義 DSL とスキーマビルダー: `apps/web/src/shared/survey/fieldDefs.ts`, `buildSurveySchema.ts`
  - コレクション定義: `apps/web/src/shared/survey/collections/*.ts`
  - 画面例: `apps/web/src/pages/survey-*/**/*.tsx`
  - テナント（workspaces / members）と認証は taskManager のものを共用している
- **アプリ固有型（設計の拡張ポイント）**
  - externalKey: `apps/web/src/shared/types/externalKeyConfig.ts`
  - file: `apps/web/src/shared/types/fileConfig.ts`

---

## 逆引き（作りたいもの別）

### 1) リストページを作りたい（2パターン）

リストページは大きく **2パターン**あります。まずどちらにするか決めると迷いません。

- **A. シンプルな一覧購読（小規模・全件寄り）**
  - **使うもの**: `useList`（`createUseList(firestore)`）
  - **参照**:
    - hook定義: `apps/web/src/shared/taskManager/hooks/index.ts`
    - 実装例: `apps/web/src/pages/taskManager-workspace/members.tsx`

- **B. 無限スクロール/増分取得（GrowingList）**
  - **使うもの**: `useGrowingList` + `FetchMore`
  - **参照**:
    - hook定義: `apps/web/src/shared/taskManager/hooks/index.ts`
    - UI部品: `apps/web/src/components/FetchMore.tsx`
    - 実装例: `apps/web/src/pages/taskManager-project/tasks.tsx`

### 2) リストページに検索機能を追加したい（検索条件をURLに載せたい）

このテンプレでは「検索フォーム」は **route定義（searchParams）とセット**で設計します。

- **決めること**
  - 検索条件を **URLのsearchParamsに載せる**（再読込/共有/戻る進むと整合する）
  - **searchParamsの型**は route 側で `validateSearch` して決める

- **参照（route定義: searchParamsのスキーマ/バリデーション）**
  - `apps/web/src/pages/taskManager-project/tasks.route.ts`
    - `searchFilterSchema`（`zf`でUIメタも持てる）
    - `validateSearch`（`fromParamsTree`）

- **参照（検索フォーム: 入力→即反映→URL更新）**
  - `apps/web/src/components/AutoSearch.tsx`（入力の購読 + debounce）
  - `apps/web/src/pages/taskManager-project/tasks.tsx`
    - `useSearch` で現在の検索条件取得
    - `navigate({ search: ... })` でURL更新

- **参照（searchのparse/stringify）**
  - `apps/web/src/pages/router.tsx`
    - `stringifySearch`: `encodeSearchParams`
    - `parseSearch`: `searchParamsToParamsTree`

- **補助（サーバ条件 + クライアント条件の分離）**
  - `apps/web/src/pages/taskManager-project/tasks.tsx`
    - Firestoreに載せる条件（`WhereParams[]`）と
    - クライアントフィルタ（`createMingoFilter`）を分離
  - `apps/web/src/components/mingoQuery.ts`

### 3) 編集ページを作りたい（詳細→更新）

編集ページの基本パターンは **doc購読（`useDoc`） + update** です。

- **参照（典型）**
  - `apps/web/src/pages/taskManager-project/task/detail.tsx`
    - `useDoc({ collection, documentIdentity })` で購読（`createUseDoc` のラッパ:
      `apps/web/src/shared/taskManager/hooks/index.ts`）
    - `AutoForm` + `collection.updateSchema` で更新
    - `accessor.updateDoc(...)` や mutations accessor の実行

- **参照（同パターン別例）**
  - `apps/web/src/pages/taskManager-workspace/member/detail.tsx`
  - `apps/web/src/pages/taskManager-workspace/detail.tsx`
  - `apps/web/src/pages/taskManager-project/detail.tsx`

- **逐次保存（フィールド単位オートセーブ）にしたい場合**
  - `ReactiveAutoForm` + `setNestedValue` で確定フィールドだけを部分更新する
  - 参照: `apps/web/src/pages/taskManager-project/task/detail.tsx` の「逐次保存」タブ
    - `onConfirm(fieldPath, value)` → `updateDoc(identity, setNestedValue({}, fieldPath, value))`
    - `onBlur` は true=確定 / false=破棄 / undefined=保留 の3値ガード

### 4) 別コレクションのデータを外部キーから解決したい（デザインパターン）

単なる「機能」ではなく、**設計判断**としてこのパターンを採用します。

- **このパターンを選ぶと何が嬉しいか**
  - データは **参照先のIDだけ**を保持し、表示や選択肢の解決はUI層で行う
  - 表示名フィールドの変更や、選択肢の絞り込み条件が **スキーマ/Resolver側に寄る**

- **決めること（最重要）**
  - フィールドは `zf.externalKey.registry` でメタを持たせる
  - 画面/フォーム側で `externalKeyResolvers` を渡して解決する

- **参照（スキーマ側: externalKey を貼る）**
  - `apps/web/src/shared/taskManager/collections/task.ts`
    - `assigneeId`, `watchers` が `membersCollection` を参照

- **参照（解決側: resolver を渡す）**
  - `apps/web/src/pages/taskManager-project/tasks.tsx`
  - `apps/web/src/pages/taskManager-project/task/detail.tsx`
    - `createFirestoreResolver({ db, storeKey })` を `externalKeyResolvers` に渡す
    - 候補の範囲は `resolverContext`（例: `{ workspace: { workspaceId } }`）と
      スキーマ側 `externalKeyConfig.getQuery` の named query で決める

- **選択肢を絞り込みたい**
  - `getQuery` に条件付きの named query を渡す
  - 参照: `apps/web/src/shared/taskManager/collections/task.ts` の `assigneeId`
    （`memberQueries.assignable()` = role を Firestore の `in` 演算子で絞り込み）

- **必須: アプリ固有型の登録（`declare module`）**
  - externalKey を使うには、アプリ側で `externalKeyConfig` の型をライブラリに登録する必要がある
  - **登録しないと** `zf.externalKey.registry` の `externalKeyConfig` が未知の型になり、型推論が効かない
  - サンプル: `apps/web/src/shared/types/externalKeyConfig.ts`
    - `declare module "@zodapp/zod-form/externalKey/types"` で `ExternalKeyConfigRegistry.config` にアプリ固有の型（例: `FirestoreExternalKeyConfig`）を設定
    - 新しい resolver を追加する場合は union に追加する（例: `FirestoreExternalKeyConfig | OtherConfig`）
  - **有効化**: `apps/web/src/shared/types/index.ts` で import しないと `declare module` が効かない。このファイルをエントリポイント付近で import すること
  - 型テスト: `apps/web/src/shared/types/externalKeyConfig.test.ts`

- **関連ドキュメント**
  - `packages/zod-form-firebase/README.ja.md`

### 5) ファイルを扱いたい（デザインパターン）

これも単なる「アップロード機能」ではなく、**設計判断**として採用します。

- **決めること（最重要）**
  - 値は **URL/参照文字列**として保持する（バイナリをモデルに直埋めしない）
  - `fileConfig` で「許可mimeType/保存先/サイズ制限」などを **スキーマに寄せる**
  - 実際のアップロード/取得/削除は **fileResolver** に寄せる

- **参照（スキーマ側: file を貼る）**
  - `apps/web/src/pages/form/schemas/file.ts`

- **参照（解決側: resolver を渡す例）**
  - `apps/web/src/pages/form/detail.tsx`（`createMockFileResolver()` を `AutoForm` に渡す）
    - 実アプリでは mock ではなく Storage resolver に差し替えるのが方針
    - `pages/form` は検証用のサンプル実装だが、fileResolver の渡し方として参照できる

- **必須: アプリ固有型の登録（`declare module`）**
  - file を使うには、アプリ側で `fileConfig` の型をライブラリに登録する必要がある
  - **登録しないと** `zf.file.registry` の `fileConfig` が未知の型になり、型推論が効かない
  - サンプル: `apps/web/src/shared/types/fileConfig.ts`
    - `declare module "@zodapp/zod-form/file/types"` で `FileConfigRegistry.config` にアプリ固有の型（例: `FirebaseStorageFileConfig | MockFileConfig`）を設定
    - 新しい resolver を追加する場合は union に追加する（例: `| S3FileConfig`）
  - **有効化**: `apps/web/src/shared/types/index.ts` で import しないと `declare module` が効かない。このファイルをエントリポイント付近で import すること
  - 型テスト: `apps/web/src/shared/types/fileConfig.test.ts`

- **関連ドキュメント**
  - `packages/zod-form-firebase/README.ja.md`（`createFirebaseStorageResolver`）

### 6) 認証つきの画面（ログイン必須）を作りたい

- **参照**
  - 認証状態: `apps/web/src/shared/auth/useAuth.ts`
    （Google / メール+パスワードのサインイン、サインアップ、パスワードリセット）
  - Provider: `apps/web/src/shared/auth/AuthProvider.tsx`
  - ガード: `apps/web/src/shared/auth/AuthGuard.tsx`
  - ガード適用例（Layoutで包む）: `apps/web/src/pages/taskManager-top/Layout.tsx`
  - ログイン/新規登録画面（AutoForm 製）: `apps/web/src/pages/taskManager-nonmember/login.tsx`
  - パスワードリセット: `apps/web/src/pages/taskManager-nonmember/passwordReset.tsx`

### 7) ページ/ルートを追加したい

- **ルート定義ファイルを作る**: `apps/web/src/pages/**/xxx.route.ts`（`createRoute` / `lazyRouteComponent`）
- **ルートツリーに繋ぐ**: `apps/web/src/pages/router.tsx` の `routeTree = rootRoute.addChildren([...])`

参照: `apps/web/src/pages/router.tsx`, `apps/web/src/pages/index.route.ts`, `apps/web/src/pages/taskManager-*/**/*.route.ts`

### 8) テーブルの列設定をユーザーに保存させたい（プロファイル）

- **使うもの**: `useColumnSettingsProfileController` + `ColumnSettingProfilePersistence`
- **参照実装（3スコープ永続化: このブラウザ / 個人 / ワークスペース共通）**
  - `apps/web/src/shared/taskManager/useProfileColumnSettings.ts`
    - スコープ接頭辞付き ID（`local:` / `user:` / `team:`）で名前空間を分離
    - local は `useLocalStorageState`、user/team は Firestore コレクション
      （`apps/web/src/shared/taskManager/collections/columnSetting.ts`）
    - 選択中プロファイルも localStorage に永続化して復元
  - 適用例: `apps/web/src/pages/taskManager-project/tasks.tsx` ほか一覧ページ全般

### 9) 複数行を選択して一括操作したい（バッチ書き込み）

- **使うもの**: `accessor.withContext({ runner: WriteBatch })`（書き込み専用アクセサ）
- **参照**: `apps/web/src/pages/taskManager-project/tasks.tsx`
  - 選択チェックボックス列（選択状態を data 側に載せた computed 列）
  - `handleBulkStatusChange` / `handleBulkArchive`（`firestore.batch()` → `batch.commit()`）

### 10) 複数ドキュメントを原子的に更新したい（トランザクション）

- **使うもの**: `firestore.runTransaction` + `accessor.withContext({ runner: transaction })`
- **参照**: `apps/web/src/pages/taskManager-project/task/detail.tsx` の `handleMove`
  - 読み取り → 移動先に作成 → 移動元を削除、を 1 トランザクションで実行

### 11) 論理削除とゴミ箱（復元）を作りたい

- **参照**
  - mutations: `apps/web/src/shared/taskManager/collections/task.ts`
    （`softDelete` / `restore`、`deleted` named query — `!=` は同一フィールドの orderBy が必要）
  - ゴミ箱ビュー + 復元列: `apps/web/src/pages/taskManager-project/tasks.tsx`

### 12) 検索条件をサーバ側（Firestore ネイティブ）で絞り込みたい

- **参照**: `apps/web/src/pages/taskManager-project/tasks.tsx` の `filterMode`
  - client: 取得済みデータに `createMingoFilter`（インデックス不要）
  - server: `==` / `>=` / `<=` を `where` に反映（組み合わせごとに複合インデックスが必要。
    `firestore.indexes.json` 参照）

### 13) サブコレクションを横断検索したい（collectionGroup）

- **使うもの**: `useCollectionGroupList`（`createUseCollectionGroupList` のラッパ）+ pathFieldKeys
- **参照**
  - コレクション側: `apps/web/src/shared/taskManager/collections/member.ts`
    （`fieldKeys: ["workspaceId"]` — パスキーをフィールドにも保存して逆引き可能にする）
  - 利用側: `apps/web/src/pages/taskManager-top/utils/userWorkspace.ts`
  - ルール側: `firestore.rules` の members collectionGroup ルール
    （自分の email で絞った list クエリのみ許可）

### 14) 任意ヘッダの CSV を取り込みたい（スキーマレスインポート）

- **使うもの**: `DynamicImportPanel`（または `useDynamicImportModal`）
- **参照**: `apps/web/src/pages/taskManager-project/tasks.tsx`
  - ヘッダ推測つきの列マッピング UI + `createSchema.safeParse` で行検証
  - スキーマ準拠の CSV は `useImportModal`、ヘッダを制御できない CSV はこちら

### 15) カスタムフィールドウィジェットを作りたい

- **使うもの**: `wrapComponent` + `ZodFormInternalProps` + `useZodField`、
  componentLibrary への `{zodType}_{uiType}` キー登録
- **参照**: `apps/web/src/pages/form/schemas/customWidget.tsx`
  （星評価 / カスケード選択の 2 例。`AutoForm` の `componentLibrary` prop で差し込む）

### 16) 実行時にスキーマを組み立てたい（ユーザー定義フォーム）

「フォームの定義自体をデータとして保存し、実行時にスキーマへ戻す」パターン。
アンケートデモ（`/survey`）が実装例。

- **定義（DSL）はメタスキーマで書く**: `apps/web/src/shared/survey/fieldDefs.ts`
  - 質問種別ごとの discriminatedUnion 配列。**定義を編集するフォーム自体も
    AutoForm / Switch が生成する**ので、専用エディタを書かずに済む
  - union セレクタで種別を選ぶと `getDefaultValue(arm)` が走るため、
    `id` を `.default(() => generateId())` にしておくと自動採番される
    （`hidden` メタは `.default()` の外側に付ける）
- **DSL → zf スキーマの変換**: `apps/web/src/shared/survey/buildSurveySchema.ts`
  - 戻り値を `{ schema, warnings, fieldErrors }` に分け、壊れた項目だけ
    表示専用のセンチネルへ差し替えて**全体の描画は継続する**
  - React 非依存の純関数にして単体テストする（`buildSurveySchema.test.ts`）
- **生成スキーマの利用側**
  - 回答フォーム: `pages/survey-workspace/survey/answer.tsx`
  - 一覧の列に展開: `pages/survey-workspace/responses.tsx`
    （`extendSchemaSafe` で record を実スキーマに差し替える）

### 17) 設定フォームとプレビューを並べたい（2カラムビルダー）

- **参照**: `apps/web/src/pages/survey-workspace/survey/SurveyBuilder.tsx`
- AutoForm はフォーム値を外部へ公開しないため、**左カラムは手組み**にする
  （`useZodForm` + `FormProvider` + `Switch fieldPath=""`）。
  手組みの場合 `componentLibrary` の注入も自前で行う
  （`ZodFormContextProvider componentLibrary={componentLibrary}`）
- 右カラムは同じ form を `useFormValues()` で購読し、
  未保存の値からプレビューを組み立てる
- アクションは `createAutoForm*Action` を自前で並べる
  （`{ form, handleSubmit, isLoading }` を渡す。`handleSubmit` は
  `form.handleSubmit()` → `schema.safeParse` の薄いラッパでよい）

### 18) フォームデモ（pages/form）に項目を追加したい

- スキーマファイルを `apps/web/src/pages/form/schemas/` に追加し、
  `schemas/index.ts` に登録する（`?raw` import でコード表示タブも埋まる）
- AutoForm の props だけで表現できないデモは、スキーマモジュールから
  `Component` を export すると detail ページがそれを描画する
  （例: `schemaTransform.tsx` / `formActions.tsx` / `customWidget.tsx`）

---

## 逆引き（機能別 / 用語から探す）

### Vite / import エイリアス

- **`@` エイリアス**: `apps/web/vite.config.ts`（`@` → `src`）
- **dev/preview ポート**: `apps/web/package.json`（`dev: 3000`, `start: 4173`）

### ルーティング（TanStack Router）

- **ルートツリー**: `apps/web/src/pages/router.tsx`
- **ルート定義**: `apps/web/src/pages/**/*.route.ts`
- **root**: `apps/web/src/pages/index.route.ts`（`createRootRoute`）, `apps/web/src/pages/layout.tsx`

### searchParams（URLの検索パラメータを型安全に）

- **parse/stringifyの基盤**: `apps/web/src/pages/router.tsx`
- **route側で型を決める**: `validateSearch` 例
  - `apps/web/src/pages/taskManager-project/tasks.route.ts`
  - `apps/web/src/pages/form/detail.route.ts`

### Firestore（定義 → CRUD/購読）

- **コレクション定義（path + schema）**: `apps/web/src/shared/taskManager/collections/*.ts`
  - `collectionConfig({ path, schema, mutations, queries, ... })`
- **Firestore 初期化/インスタンス**: `@repo/firebase`
  - 参照: `packages/firebase/src/index.ts`
- **CRUD/購読アクセサ**: `getAccessor`（`@zodapp/zod-firebase-browser`）
  - 例: `apps/web/src/pages/taskManager-project/tasks.tsx`
  - 例: `apps/web/src/pages/taskManager-project/task/detail.tsx`
- **React hooks（firestoreバインド済み）**: `apps/web/src/shared/taskManager/hooks/index.ts`

### フィルタ（サーバ条件 + クライアント条件）

- **クライアントフィルタ生成**: `apps/web/src/components/mingoQuery.ts`
- **適用例**: `apps/web/src/pages/taskManager-project/tasks.tsx`

### スキーマ→UI自動生成（フォーム/テーブル/検索）

- **AutoForm（入力/バリデーション/送信）**: `apps/web/src/components/AutoForm.tsx`
  （`@zodapp/zod-form-widget/form` の re-export）
- **AutoTable（一覧表示）**: `@zodapp/zod-form-widget/table` から直接 import
  - アクション列は `extendSchemaSafe`（列設定の対象になる）と
    `trailingSchema`（常に末尾固定）の 2 方式。
    参照: `apps/web/src/pages/taskManager-project/tasks.tsx`（前者） /
    `apps/web/src/pages/taskManager-workspace/projects.tsx`（後者）
- **AutoSearch（入力→即反映）**: `apps/web/src/components/AutoSearch.tsx`

### 外部キー / ファイル（設計パターン）

詳細は「作りたいもの別」を参照。

- **外部キー（別コレクション参照）**: 「別コレクションのデータを外部キーから解決したい（デザインパターン）」
- **ファイル（アップロード/プレビュー/削除）**: 「ファイルを扱いたい（デザインパターン）」

---

## @zodapp/\* 関連ドキュメント（入口）

- `@zodapp/zod-firebase`: `packages/zod-firebase/README.ja.md`
- `@zodapp/zod-firebase-browser`: `packages/zod-firebase-browser/README.ja.md`
- `@zodapp/zod-form-mantine`: `packages/zod-form-mantine/README.ja.md`
- `@zodapp/zod-form-firebase`: `packages/zod-form-firebase/README.ja.md`

---

## よくある落とし穴（このテンプレ特有）

- **`firebaseConfig.json` をコミットしない**
  - `.gitignore` 済み。ローカルで作る（`apps/web/README.ja.md` 参照）
- **`dataSchema.extend({})` の意図**
  - `register` が破壊的なため、表示用に `extend({})` でコピーしてから `register` する（例: `apps/web/src/pages/taskManager-project/tasks.tsx`, `apps/web/src/pages/taskManager-top/workspaces.tsx`）
- **computed フィールドのテーブル表示**
  - `AutoTable` は computed には親オブジェクトを渡す実装になっている（`@zodapp/zod-form-widget/table`）
- **searchParams は route 側で型を決める**
  - 画面側で好き勝手に `search` を組むのではなく、`*.route.ts` の `validateSearch` とセットで設計する
