# アンケートフォームアプリ（第3デモ）実装プラン

apps/web に「フォームデモ」「タスク管理」と並ぶ第3のデモとして、
**アンケートフォームアプリ（Survey）** を追加するための handover プラン。

- ステータス: 計画（実装未着手）
- 対象ブランチ: `claude/zodapp-sample-improvement-77f920`（このプランと同じブランチに実装を積む想定）
- 由来: aibpo-core 側のサンプル改善計画（`docs/plans/zodapp-improvement/03-new-sample-apps.md` の N3「フォームビルダー」）を、
  レビューを経て「taskManager と並ぶアンケートフォームアプリ」として再定義したもの

---

## 1. 背景

### なぜこのサンプルを作るのか

zodapp は「Zod スキーマを単一情報源として、フォーム UI / テーブル UI / Firestore 連携を
自動生成する」フレームワークだが、既存サンプル（フォームデモ / タスク管理）はいずれも
**開発時に静的に定義したスキーマ**を使っている。

アンケートフォームアプリは、**ユーザーがフォームを設計 → 定義を JSON（DSL）として
Firestore に保存 → 実行時にスキーマを再構築して回答フォームを自動生成 → 回答を集計**
という流れで、zodapp の「スキーマ＝データ」という思想の応用形
（**ランタイムスキーマ生成**）を示すフラッグシップサンプルとなる。

実運用プロジェクト（aibpo-core）ではこのパターンが本番稼働しており
（DSL → zf スキーマの実行時構築、壊れたフィールドのみ落として描画継続する
エラーセンチネル等）、OSS サンプルとして一般化する価値が実証済み。

### このブランチの現状（前提となる完成済みの土台）

`claude/zodapp-sample-improvement-77f920` には既に以下が入っており、本アプリはこれらを再利用する:

| 土台 | 場所 |
| --- | --- |
| メール/パスワード認証 + AuthGuard | `apps/web/src/shared/auth/*` |
| マルチテナント（workspaces / members、collectionGroup 所属検索） | `apps/web/src/shared/taskManager/collections/*`, `pages/taskManager-top/*` |
| firestore バインド済み hooks（useList / useGrowingList / useDoc / useCollectionGroupList） | `apps/web/src/shared/taskManager/hooks/index.ts` |
| 列設定プロファイル 3 スコープ永続化 | `apps/web/src/shared/taskManager/useProfileColumnSettings.ts` |
| AutoForm の `componentLibrary` prop / スキーマモジュールの `Component` 拡張点 | `packages/zod-form-widget/src/form/AutoForm.tsx`, `apps/web/src/pages/form/detail.tsx` |
| カスタムアクション（draft/publish、disabled 述語）デモ | `apps/web/src/pages/form/schemas/formActions.tsx` |
| zf.dynamic（実行時スキーマ解決）デモ | `apps/web/src/pages/form/schemas/dynamicSchema.ts` |
| エミュレータモード（`VITE_FIREBASE_EMULATOR=1`、本番プロジェクト不要） | `packages/firebase/src/index.ts`, `firebase.json` |
| Playwright E2E の実績（エミュレータ + メール認証で全フロー検証） | コミットメッセージおよび AGENT.md 参照 |

---

## 2. 要求仕様（レビュー済み・確定）

1. **マルチテナント**: taskManager と同様の仕組みとする
2. **テナントごとに複数のアンケートを作成できる**
3. **回答の保存**: アンケートに回答すると「回答」に保存される。
   **アンケートと回答はサブコレクションではなく同じ階層**とすることで、
   アンケート横断検索もできるようにする
4. **アンケート作成画面は 2 カラム構成**: 左に設定、右にプレビュー
   （aibpo-core と同じ構成。**このサンプルとしての意味が大きい＝最重要要件**）
5. **分析機能は将来スコープ**（今回はスコープ外。ただしデータモデルは分析を妨げない形にする）

---

## 3. 設計

### 3.1 配置とルーティング

apps/web 内の第3セクションとして追加する（新規アプリは作らない）。
taskManager のディレクトリ/ルート構成に倣う。

```
/survey/login → taskManager と共通のログインへ誘導（後述）
/survey/workspaces                                  … ワークスペース一覧（taskManager と共通データ）
/survey/workspaces/:workspaceId/surveys             … アンケート一覧
/survey/workspaces/:workspaceId/surveys/:surveyId   … アンケート編集（2カラムビルダー）
/survey/workspaces/:workspaceId/surveys/:surveyId/answer … 回答フォーム
/survey/workspaces/:workspaceId/responses           … 回答一覧（アンケート横断）
```

- ディレクトリは `apps/web/src/pages/survey-top/`, `survey-workspace/`, `survey-item/` の
  ような taskManager- 系と同じ粒度で分割する
- トップナビ（`pages/top/Layout.tsx` の CommonLayout navItems）に「アンケートデモ」を追加する

### 3.2 マルチテナント: taskManager のワークスペースを共用する

**推奨: workspaces / members コレクションと認証まわりを taskManager と共用する。**

- 要求仕様の「taskManager と同様の仕組み」を最も直接的に満たし、
  「同じテナント基盤の上に複数アプリを載せられる」ことのデモにもなる
- `shared/taskManager/` 配下のコレクション定義・hooks はそのまま import する
  （必要なら共有部分を `shared/workspace/` へリネームする改名リファクタは任意。
  実施する場合は独立コミットにすること）
- ワークスペース一覧ページは taskManager のものとほぼ同一になるため、
  一覧テーブル部分を共通コンポーネント化して両セクションから使うとよい

### 3.3 データモデル

#### surveys（アンケート定義）

```
/workspaces/:workspaceId/surveys/:surveyId
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| title | string（必須） | アンケート名 |
| description | string?（multiline） | 説明（回答フォームの冒頭に表示） |
| status | enum: draft / published / closed | 公開状態。published のみ回答可能 |
| fields | SurveyFieldDef[]（後述の DSL） | フィールド定義。JSON として保存 |
| revision | number | publish のたびにインクリメント（回答との突合用） |
| createdAt / updatedAt / publishedAt | date | 慣例どおり onCreate / onWrite / mutation で付与 |
| deletedAt | date \| null | 論理削除（taskManager と同じ規約） |

- `createCollectionMutations`: `publish`（status→published, revision+1, publishedAt）/
  `close` / `reopen` / `softDelete` / `restore`
- `createCollectionQueries`: `active` / `published`
- `createCollectionReference(surveysCollection, { labelField: "title" })`
  … 回答一覧の surveyId 外部キー表示に使う

#### responses（回答）— アンケートと同階層

```
/workspaces/:workspaceId/responses/:responseId
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| surveyId | string（externalKey → surveys） | どのアンケートへの回答か |
| surveyRevision | number | 回答時点のアンケート revision |
| answers | Record<fieldId, unknown> | 回答本体。キーは SurveyFieldDef.id |
| respondentName | string? | 回答者表示名（MVP はログインユーザーの displayName を自動設定） |
| submittedAt | date | onCreate |

**設計上の要点（要求仕様 3 の実現方法）**:

- surveys と responses を**兄弟コレクション**にし、responses 側に `surveyId` を
  **通常のスキーマフィールド**として持たせる。
  これにより `/workspaces/:id/responses` への 1 クエリでアンケート横断検索ができ、
  `bySurvey(surveyId)` named query で特定アンケートに絞り込める
- **注意: `fieldKeys: ["surveyId"]`（nonPathKeys）にはしないこと。**
  nonPathKeys は documentIdentity の必須キーになり autoQuery で常に
  `surveyId ==` が強制されるため、「surveyId 指定なしの横断クエリ」が
  アクセサの型上できなくなる（`packages/zod-firebase/README.ja.md` の
  nonPathKeys / autoQuery の節を参照）。横断検索要件と両立しない
- `surveyId` は `zf.externalKey.registry` + `surveysReference` で貼り、
  回答一覧でアンケート名が自動解決される形にする（既存の assigneeId と同じパターン）
- `answers` は `zf.record` とし、回答一覧テーブルでは
  **record 動的列テンプレート**（`extractSchemaRecordTemplates`、
  `@zodapp/zod-form-widget/table`）で列を実行時に決定する。
  ここが zod-form-widget の未実演機能（record 動的列）の実演ポイント

#### Firestore ルール

taskManager の members ベースの権限をそのまま使う:

- surveys: read = isMember、write = canWriteTask 相当（owner/admin/member）
- responses: read = isMember、**create = isMember**（MVP。公開回答は将来スコープ）、
  update/delete = isAdmin（回答改竄防止のため一般メンバーには不可）
- `apps/web/tests/firestore.rules.test.ts` にケースを追加する
  （既存 29 テストと同じ流儀。emulator は `pnpm emulator:test` で自動起動）

### 3.4 フィールド定義 DSL

MVP のフィールド種別は 6 種。**判別付き union（type で判別）の配列**として保存する。

```ts
type SurveyFieldDef =
  | { type: "text";      id: string; label: string; required?: boolean; placeholder?: string }
  | { type: "multiline"; id: string; label: string; required?: boolean }
  | { type: "number";    id: string; label: string; required?: boolean; min?: number; max?: number }
  | { type: "select";    id: string; label: string; required?: boolean; options: { value: string; label: string }[] }
  | { type: "boolean";   id: string; label: string; required?: boolean }   // 同意チェック等
  | { type: "date";      id: string; label: string; required?: boolean };
```

- **DSL 自体も zf スキーマで定義する**（`zf.array(zf.union([...討別 union...]))` +
  `discriminator: "id"`）。つまり「フィールド定義を編集するフォーム」も AutoForm で
  自動生成される — メタスキーマのデモ
- `id` は追加時に自動採番（`crypto.randomUUID()` の短縮など）。ユーザーには編集させない
  （回答の answers キーとの整合を守るため）
- aibpo-core の `buildParamsSchema` は**移植しない**。上記 6 種に対する最小の
  `buildSurveySchema` を新規に書く（下記）

### 3.5 ランタイムスキーマ生成（buildSurveySchema）

```ts
// apps/web/src/shared/survey/buildSurveySchema.ts（新規）
type BuildResult = {
  schema: z.ZodObject<...>;      // answers 用の zf スキーマ（キーは field.id）
  warnings: string[];            // 描画は継続するが注意を出す事項
  fieldErrors: { id: string; message: string }[]; // 復元不能フィールド
};
export function buildSurveySchema(fields: SurveyFieldDef[]): BuildResult;
```

- フィールド 1 件が不正でも**全体を失敗させず**、そのフィールドだけ
  `zf.common()` + 独自 uiType のエラーセンチネル（「表示できない項目」プレースホルダ）に
  差し替えて描画を継続する。`{schema, warnings, fieldErrors}` の 3 分割は
  aibpo-core で実証済みのパターンの一般化
- required でない場合は `.optional()`、select は `zf.enum`（options から literal 生成 +
  label メタ）、multiline は `uiType: "multiline"` … と、DSL → zf メタの対応を
  1 箇所に閉じ込める
- 単体テスト（vitest）を必ず付ける: 正常系 6 種 / 不正フィールド混入 /
  空配列 / options 空の select など

### 3.6 アンケート編集画面（2 カラムビルダー）— 最重要

aibpo-core と同じ「左: 設定 / 右: プレビュー」の 2 カラム構成。

```
+--------------------------------+--------------------------------+
| 設定（編集フォーム）           | プレビュー（回答フォーム）     |
|  - タイトル / 説明 / ステータス |  buildSurveySchema(fields) の  |
|  - フィールド定義の配列編集    |  結果を AutoForm で描画        |
|    （追加/削除/並べ替え/種別）  |  （fieldErrors はセンチレル表示)|
|  [破棄] [下書き保存] [公開]    |  ※ 送信ボタンなし readOnly不可 |
+--------------------------------+--------------------------------+
```

- 左カラム: `AutoForm` + surveys の updateSchema。
  fields は判別 union 配列なので、**配列の DnD 並べ替え / 種別セレクタ付き追加**が
  zod-form-mantine の標準機能でそのまま出る（array + discriminatedUnion デモ）
- 右カラム: 左フォームの**編集中の値**（保存前）からリアルタイムに
  `buildSurveySchema` してプレビューを再構築する。
  実装方式: 左の AutoForm に `onChange` 相当がないため、
  `actions` ではなく **左右を 1 つの親コンポーネントで持ち、
  AutoForm の Form API（`useFormValues`）を使うか、
  フォームを `FormProvider` + `Switch` で手組みして値を購読する**。
  最小実装としては「左フォームの保存済み値 + 明示的な『プレビュー更新』」でもよいが、
  ライブプレビューが本命（実装検討メモ参照）
- アクションバー: `AutoFormAction` で「変更を破棄 / 下書き保存 / 公開する」。
  公開は `formState.isDefaultValue`（未保存変更なし）のときだけ有効 —
  `pages/form/schemas/formActions.tsx` の実運用版
- レイアウトは Mantine `Grid` / `Flex` の 2 カラム。狭幅では縦積み

**実装検討メモ（ライブプレビュー）**: `zod-form-widget` の AutoForm は
フォーム値の外部購読手段として `showPreview`（内部 JSON 表示）しか持たない。
ライブプレビューには次のどちらかを選ぶ:
1. ビルダー左側を `useZodForm` + `FormProvider` + `Switch fieldPath=""` で手組みし、
   `useFormValues()` で値を購読して右側に渡す（`@zodapp/zod-form-react` の
   基盤 API の実演になるのでこちらを推奨）
2. AutoForm に `onValuesChange?: (values) => void` prop をライブラリ側に追加する
   （小さな追加。やる場合は `fix/feat(zod-form-widget)` として独立コミット）

### 3.7 回答フォーム画面

- `/surveys/:surveyId/answer`。published のアンケートのみ回答可（draft/closed は案内表示）
- `buildSurveySchema(survey.fields)` → `AutoForm` → onSubmit で
  `responsesCollection.createDoc({workspaceId}, { surveyId, surveyRevision, answers, ... })`
- 送信後はサンクス表示 + 「もう一度回答」
- MVP はログインメンバーのみ（AuthGuard 配下）。匿名回答は将来スコープ

### 3.8 回答一覧画面（アンケート横断）

- `/responses`: ワークスペース内の全回答を `useGrowingList` で一覧
  - AutoSearch: surveyId（externalKey / surveysReference で名前解決）、期間
  - answers の record 動的列 + 列設定プロファイル（`useProfileColumnSettings`）
  - CSV エクスポート（`useExportModal` + `useExportFetchAll` の既存パターン）
- アンケート編集画面からは「このアンケートの回答一覧」リンクで
  `?q.surveyId=...` 付きの同一ページへ遷移（横断/絞り込みが同じ画面で済むことを見せる）

---

## 4. このサンプルが新たに実演する zodapp API（カバレッジ観点）

| API / パターン | 現状 | 本アプリでの実演箇所 |
| --- | --- | --- |
| DSL → zf ランタイムスキーマ生成（3 分割 + エラーセンチネル） | 露出ゼロ | buildSurveySchema |
| record 動的列テンプレート（extractSchemaRecordTemplates 系） | 露出ゼロ | 回答一覧の answers 列 |
| 判別 union 配列の編集 UI（DnD + discriminator + 種別追加） | フォームデモに断片のみ | フィールド定義エディタ |
| FormProvider + Switch + useFormValues による手組みフォーム | 露出ゼロ | ビルダー左カラム（ライブプレビュー方式 1 の場合） |
| AutoFormAction の実運用（publish ワークフロー） | デモのみ | ビルダーのアクションバー |
| 兄弟コレクション + named query による横断/絞り込み設計 | — | responses |

---

## 5. 実装フェーズ（コミット粒度の目安）

1. **P1: データ層** — surveys / responses コレクション定義、DSL 型、
   buildSurveySchema + 単体テスト、firestore.rules + ルールテスト
2. **P2: 一覧と CRUD の骨格** — ルーティング一式、アンケート一覧
   （作成/削除/複製、status バッジ列）、ナビ追加
3. **P3: 2 カラムビルダー** — 設定フォーム + ライブプレビュー + publish アクション
   （最重要。ライブプレビュー方式はここで確定させる）
4. **P4: 回答フロー** — 回答フォーム + 回答一覧（横断検索 / 動的列 / CSV）
5. **P5: 仕上げ** — E2E（Playwright + エミュレータ）、AGENT.md 逆引き追記、
   README 追記、シードデータ（サンプルアンケート投入メニュー）

各フェーズ完了時に `pnpm --filter web check-types` / `pnpm build` /
`pnpm emulator:test` を通してからコミットする（このブランチの慣例）。

---

## 6. 検証方法（このブランチで確立済みの手順）

```bash
# エミュレータ（auth/firestore/storage）
npx firebase emulators:start --only auth,firestore,storage --project demo-zodapp

# エミュレータ接続で dev サーバ
cd apps/web && VITE_FIREBASE_EMULATOR=1 pnpm dev   # localhost:3000

# ルールテスト込みの全テスト
pnpm emulator:test
```

- `firebaseConfig.json` はリポジトリルートにダミー値で作成（gitignore 済み）
- E2E は Playwright（`/opt/pw-browsers/chromium` 等ローカルの Chromium）で
  「サインアップ → ワークスペース作成 → アンケート作成 → 公開 → 回答 → 横断一覧」
  を一巡させる。既存デモの E2E と同様、メール/パスワード認証で自動化できる

---

## 7. 未決事項（実装者への引き継ぎ。推奨付き）

| # | 論点 | 推奨 |
| --- | --- | --- |
| 1 | ワークスペース基盤の共用方法（taskManager の shared をそのまま import するか、`shared/workspace/` へ改名リファクタするか） | まず import 共用で開始。改名は任意・独立コミット |
| 2 | ライブプレビューの実装方式（3.6 のメモ参照） | 方式 1（FormProvider + Switch + useFormValues の手組み）。ライブラリ API の実演価値が高い |
| 3 | 回答の匿名公開（ログインなし回答） | スコープ外。rules とデータモデルは阻害しない（responses が兄弟コレクションなので公開時は rules 追加のみ） |
| 4 | アンケート編集と公開後回答の整合（published 後の fields 編集） | MVP は revision 記録のみ（回答に surveyRevision を保存）。published 中の編集は警告表示に留める。完全なバージョニング（公開スナップショット分離）は将来スコープ |
| 5 | セクション名 / ルートプレフィックス | `/survey`、表示名「アンケートデモ」 |

---

## 8. スコープ外（将来）

- 分析機能（集計・グラフ）。**ただし responses が兄弟コレクション + record answers なので、
  集計クエリ/クライアント集計のどちらにも進める**
- 匿名・外部公開回答（公開リンク、Anonymous Auth）
- 公開スナップショットを分離する完全なバージョニング
- 回答の編集・下書き保存

---

## 9. 参考

- 元計画: aibpo-core `docs/plans/zodapp-improvement/03-new-sample-apps.md`（N3）
- 実装パターンの参照元（本ブランチ内）:
  - コレクション定義の慣例: `apps/web/src/shared/taskManager/collections/task.ts`
  - 一覧ページの型: `apps/web/src/pages/taskManager-project/tasks.tsx`
  - publish アクション: `apps/web/src/pages/form/schemas/formActions.tsx`
  - 実行時スキーマ解決: `apps/web/src/pages/form/schemas/dynamicSchema.ts`
  - 逆引きガイド: `apps/web/AGENT.md`
- aibpo-core の該当実装（クローズドのためコードは移植せず、パターンのみ参照）:
  DSL → スキーマ構築の 3 分割戻り値、エラーセンチネル、2 カラムビルダー構成
