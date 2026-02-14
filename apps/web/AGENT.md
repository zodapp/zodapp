## apps/web — アプリ開発テンプレ（@zodapp/* サンプル）

`apps/web` は、`@zodapp/*` ファミリを **実アプリに流用するためのテンプレ兼サンプル実装**です。

- **ルーティング**: TanStack Router（コードベースルーティング）
- **UI**: React + Vite + Mantine
- **データ**: Firebase（Firestore / compat）

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

参照: `apps/web/README.ja.md`, `packages/firebase/src/index.ts`, `.gitignore`

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

編集ページの基本パターンは **doc購読（`docSync`） + update** です。

- **参照（典型）**
  - `apps/web/src/pages/taskManager-project/task/detail.tsx`
    - `getAccessor(firestore, collection)`
    - `accessor.docSync(...)` で購読
    - `AutoForm` + `collection.updateSchema` で更新
    - `accessor.updateDoc(...)` や `accessor.mutations.*` の実行

- **参照（同パターン別例）**
  - `apps/web/src/pages/taskManager-workspace/member/detail.tsx`
  - `apps/web/src/pages/taskManager-workspace/detail.tsx`
  - `apps/web/src/pages/taskManager-project/detail.tsx`

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
    - `createFirestoreResolver({ db, conditions: { ... } })`
    - `identityParams`（例: `workspaceId` を固定）で「どの範囲の候補を出すか」を決める

- **参照（アプリ固有型: 設計の拡張ポイント）**
  - `apps/web/src/shared/types/externalKeyConfig.ts`

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

- **参照（アプリ固有型: 設計の拡張ポイント）**
  - `apps/web/src/shared/types/fileConfig.ts`（`firebaseStorage | mock` の union）

- **関連ドキュメント**
  - `packages/zod-form-firebase/README.ja.md`（`createFirebaseStorageResolver`）

### 6) 認証つきの画面（ログイン必須）を作りたい

- **参照**
  - 認証状態: `apps/web/src/shared/auth/useAuth.ts`
  - Provider: `apps/web/src/shared/auth/AuthProvider.tsx`
  - ガード: `apps/web/src/shared/auth/AuthGuard.tsx`
  - ガード適用例（Layoutで包む）: `apps/web/src/pages/taskManager-top/Layout.tsx`
  - ログイン画面: `apps/web/src/pages/taskManager-nonmember/login.tsx`

### 7) ページ/ルートを追加したい

- **ルート定義ファイルを作る**: `apps/web/src/pages/**/xxx.route.ts`（`createRoute` / `lazyRouteComponent`）
- **ルートツリーに繋ぐ**: `apps/web/src/pages/router.tsx` の `routeTree = rootRoute.addChildren([...])`

参照: `apps/web/src/pages/router.tsx`, `apps/web/src/pages/index.route.ts`, `apps/web/src/pages/taskManager-*/**/*.route.ts`

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
- **AutoTable（一覧表示）**: `apps/web/src/components/AutoTable.tsx`
- **AutoSearch（入力→即反映）**: `apps/web/src/components/AutoSearch.tsx`

### 外部キー / ファイル（設計パターン）

詳細は「作りたいもの別」を参照。

- **外部キー（別コレクション参照）**: 「別コレクションのデータを外部キーから解決したい（デザインパターン）」
- **ファイル（アップロード/プレビュー/削除）**: 「ファイルを扱いたい（デザインパターン）」

---

## @zodapp/* 関連ドキュメント（入口）

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
  - `AutoTable` は computed には親オブジェクトを `defaultValue` として渡す実装になっている（`apps/web/src/components/AutoTable.tsx`）
- **searchParams は route 側で型を決める**
  - 画面側で好き勝手に `search` を組むのではなく、`*.route.ts` の `validateSearch` とセットで設計する
