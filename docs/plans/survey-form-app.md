# アンケートフォームアプリ（第3デモ）実装プラン【詳細版】

apps/web に「フォームデモ」「タスク管理」と並ぶ第3のデモとして、
**アンケートフォームアプリ（Survey）** を追加するための handover プラン。

- ステータス: 詳細設計済み（実装未着手）
- 対象ブランチ: `claude/zodapp-sample-improvement-77f920`（このプランと同じブランチに実装を積む）
- 由来: aibpo-core 側のサンプル改善計画（N3「フォームビルダー」）をレビューを経て
  「taskManager と並ぶアンケートフォームアプリ」として再定義したもの
- 本詳細版は、taskManager の実装（レイアウト/ルーティング/認可/ページ慣例）と
  ライブラリ実装（union 配列編集・record 動的列・フォーム手組み API）の
  **コード調査に基づいて**設計を確定させている。「調査済み」と記した挙動は
  ソースで確認済みのもの

---

## 1. 背景

### なぜこのサンプルを作るのか

zodapp は「Zod スキーマを単一情報源として、フォーム UI / テーブル UI / Firestore 連携を
自動生成する」フレームワークだが、既存サンプルはいずれも**開発時に静的に定義した
スキーマ**を使っている。

アンケートフォームアプリは、**ユーザーがフォームを設計 → 定義を JSON（DSL）として
Firestore に保存 → 実行時にスキーマを再構築して回答フォームを自動生成 → 回答を蓄積**
という流れで、zodapp の「スキーマ＝データ」という思想の応用形
（**ランタイムスキーマ生成**）を示すフラッグシップサンプルとなる。
実運用プロジェクト（aibpo-core）で本番稼働実績のあるパターンの一般化。

### このブランチの現状（前提となる完成済みの土台）

| 土台 | 場所 |
| --- | --- |
| メール/パスワード認証 + AuthGuard | `apps/web/src/shared/auth/*` |
| マルチテナント（workspaces / members、collectionGroup 所属検索） | `apps/web/src/shared/taskManager/collections/*`, `pages/taskManager-top/*` |
| firestore バインド済み hooks（useList / useGrowingList / useDoc / useCollectionGroupList） | `apps/web/src/shared/taskManager/hooks/index.ts` |
| 列設定プロファイル 3 スコープ永続化 | `apps/web/src/shared/taskManager/useProfileColumnSettings.ts` |
| AutoForm の `componentLibrary` prop / カスタムアクション / zf.dynamic デモ | `packages/zod-form-widget`, `apps/web/src/pages/form/schemas/*` |
| エミュレータモード（`VITE_FIREBASE_EMULATOR=1`） | `packages/firebase/src/index.ts`, `firebase.json` |

---

## 2. 要求仕様（レビュー済み・確定）

1. **マルチテナント**: taskManager と同様の仕組みとする
2. **テナントごとに複数のアンケートを作成できる**
3. **回答の保存**: アンケートと回答は**サブコレクションではなく同じ階層**とし、
   アンケート横断検索もできるようにする
4. **アンケート作成画面は 2 カラム構成**（設定 + プレビュー）。
   aibpo-core と同じ構成で、**このサンプルとしての意味が最も大きい**
5. **分析機能は将来スコープ**（データモデルは分析を妨げない形にする）

追加の全体方針（今回の指示）: **デザイン・UI・認可まわりの仕組みは taskManager に揃える。**

---

## 3. 全体像

### 3.1 画面フロー

```
トップナビ「アンケートデモ」
  └ /survey/workspaces …………………………… ワークスペース一覧（taskManager と同一データ）
      └ /survey/workspaces/:wid/surveys ……… アンケート一覧（作成/複製/ゴミ箱）
          ├ …/surveys/:sid ……………………… ビルダー（2カラム: 設定+プレビュー）★中核
          └ …/surveys/:sid/answer …………… 回答フォーム（published のみ）
      └ /survey/workspaces/:wid/responses … 回答一覧（アンケート横断 / 絞り込み）
```

### 3.2 ルートツリー（router.tsx への追加。taskManager の構造を踏襲・調査済み）

taskManager は「セクション root（redirect 用 index）→ id 付き layout route（AuthGuard +
CommonLayout）→ 各ページ route」の 3 層構成（`pages/router.tsx` 参照）。同じ形で追加する:

```tsx
// router.tsx への追加イメージ
surveyRoute.addChildren([                       // path: "survey"（index は workspaces へ Navigate）
  surveyTopLayoutRoute.addChildren([            // id: "survey-top"
    surveyWorkspacesRoute,                      // path: "workspaces"
  ]),
  surveyWorkspaceLayoutRoute.addChildren([      // path: "workspaces/$workspaceId"
    surveysRoute,                               // path: "surveys"
    surveyEditRoute,                            // path: "surveys/$surveyId"
    surveyAnswerRoute,                          // path: "surveys/$surveyId/answer"
    responsesRoute,                             // path: "responses"
  ]),
]),
```

- ログイン系ルートは追加しない（3.4 参照）
- `surveyRoute` の index コンポーネントは `taskManager-top/index.tsx` と同じ
  「セクション直アクセスで workspaces へ `Navigate`」パターン

### 3.3 ディレクトリ構成（新規ファイル一覧）

taskManager- 系と同じ粒度で分割する:

```
apps/web/src/shared/survey/
  collections/
    survey.ts            … surveysCollection + reference/queries/mutations
    response.ts          … responsesCollection + queries
    index.ts
  fieldDefs.ts           … DSL（SurveyFieldDef）の zf メタスキーマ & 型
  buildSurveySchema.ts   … DSL → zf スキーマのランタイムビルダー
  buildSurveySchema.test.ts

apps/web/src/pages/survey-top/
  index.route.ts / index.tsx        … /survey（workspaces へ redirect）
  layout.route.ts / Layout.tsx      … AuthGuard + CommonLayout（backLink: トップ）
  workspaces.route.ts / workspaces.tsx … ワークスペース一覧（survey 系へのリンク）

apps/web/src/pages/survey-workspace/
  layout.route.ts / Layout.tsx      … AuthGuard + CommonLayout（nav: アンケート/回答）
  surveys.route.ts / surveys.tsx    … アンケート一覧
  responses.route.ts / responses.tsx … 回答一覧（横断）
  survey/
    edit.route.ts / edit.tsx        … 2カラムビルダー ★
    answer.route.ts / answer.tsx    … 回答フォーム
  seed.ts                           … サンプルアンケート投入
```

---

## 4. taskManager との整合（デザイン・UI・認可の対応表）

「揃える」の具体的な意味を対応表で固定する。実装時はこの表に従うこと。

| 項目 | taskManager での実装 | Survey での適用 |
| --- | --- | --- |
| セクション root | `taskManager-top/index.tsx`（直アクセスで workspaces へ Navigate） | 同形式の `survey-top/index.tsx` |
| レイアウト | 各階層の `Layout.tsx` = `AuthGuard` で包んだ `CommonLayout`（navItems + backLink） | 同じ。survey-top は backLink「トップに戻る」+ nav「ワークスペース一覧」。survey-workspace は backLink「ワークスペース一覧」+ nav「アンケート一覧」「回答一覧」 |
| 認可 | `AuthGuard`（未ログインは `loginRoute` へ Navigate）。ログイン画面は taskManager-nonmember | **同じ AuthGuard・同じログイン画面を共用**。survey 用のログイン画面は作らない（ログイン後は taskManager workspaces に着地し、トップナビから survey へ入る。リダイレクト先の記憶は本デモのスコープ外） |
| テナント | workspaces / members コレクション + collectionGroup 所属検索（`useUserWorkspaces`） | **同一コレクションを共用**。`shared/taskManager/collections` と `useUserWorkspaces` をそのまま import（改名リファクタはしない） |
| ページヘッダ | `Container` + `Group justify="space-between"` + `Title order={2}` + 右側に codeViewerTrigger / 新規作成 ActionIcon（IconPlus, radius="xl"）/ IconDotsVertical メニュー | 同じ構成（`tasks.tsx` / `projects.tsx` を雛形にする） |
| 検索エリア | `Box`（gray-0/dark-6 背景, radius 8px）内に `AutoSearch` | 回答一覧で同じ |
| 一覧テーブル | `AutoTable` + `useProfileColumnSettings` + `useTableSettingDrawer`、アクション列は `createActionSchema` | 同じ。アンケート一覧は extendSchemaSafe 方式（tasks と同じ） |
| コード表示 | 各ページ右上の `useCodeViewerModal({ pageCode, collectionCode })`（`?raw` import） | 全ページに付ける（ビルダーは pageCode + fieldDefs/buildSurveySchema のコードも見せたいので、必要なら CodeViewerModal をタブ追加できる形に軽微拡張してよい） |
| 新規作成 | モーダル + `AutoForm` + `createSchema` + `onInit()` | アンケート作成も同じ（作成後にビルダーへ遷移） |
| 論理削除 | `deletedAt` + `softDelete`/`restore` mutations + `active`/`deleted` named query + ゴミ箱 SegmentedControl | surveys に同じ規約を適用（responses は対象外・6.2 参照） |
| ダミーデータ | メニュー「ダミーデータ追加」+ `seed.ts` | 「サンプルアンケート追加」（6 種の質問を含むアンケート 1 件 + published 済み 1 件） |
| Firestore ルール | workspaces 配下で members のロールによる制御（isMember / canWriteTask / isAdmin） | surveys / responses を同じヘルパで制御（7 章） |
| 列設定 | `useProfileColumnSettings`（3 スコープ） | 同じ（tableKey は 9.3 参照） |

---

## 5. データモデル

### 5.1 surveys（アンケート定義）

```
/workspaces/:workspaceId/surveys/:surveyId
```

```ts
// shared/survey/collections/survey.ts（スケッチ）
export const surveyStatusLiterals = [
  z.literal("draft").register(zf.literal.registry,     { label: "下書き", color: "gray" }),
  z.literal("published").register(zf.literal.registry, { label: "公開中", color: "green" }),
  z.literal("closed").register(zf.literal.registry,    { label: "終了",   color: "orange" }),
] as const;

const surveyDataSchema = z.object({
  title: zf.string().min(1).register(zf.string.registry, { label: "アンケート名", width: 200 }),
  description: zf.string().register(zf.string.registry,
    { label: "説明", uiType: "multiline" }).optional(),
  status: zf.enum(surveyStatusLiterals).register(zf.enum.registry,
    { label: "状態", uiType: "badge", width: 80 }).default("draft"),
  fields: surveyFieldsSchema,          // ← 6 章の DSL メタスキーマ
  deletedAt: zf.date().register(zf.date.registry, { label: "削除日" })
    .nullable().register(zf.common.registry, { hidden: true }),
}).register(zf.object.registry, {});

const surveyCreateExcludedSchema = z.object({
  revision:    zf.number().register(zf.number.registry, { label: "公開版", readOnly: true, width: 70 }).optional(),
  publishedAt: zf.date().register(zf.date.registry, { label: "公開日", readOnly: true, width: 100 }).optional(),
  createdAt:   zf.date().register(zf.date.registry, { label: "作成日", readOnly: true, width: 100 }).optional(),
  updatedAt:   zf.date().register(zf.date.registry, { label: "更新日", readOnly: true, width: 100 }).optional(),
});

export const surveysCollection = collectionConfig({
  path: "/workspaces/:workspaceId/surveys/:surveyId" as const,
  fieldKeys: [] as const,
  schema: surveyDataSchema,
  createExcludedSchema: surveyCreateExcludedSchema,
  onCreate: () => ({ createdAt: new Date(), revision: 0 }),
  onWrite:  () => ({ updatedAt: new Date() }),
  onInit:   () => ({ status: "draft" as const, fields: [], deletedAt: null }),
});

export const surveysReference = createCollectionReference(surveysCollection, {
  labelField: "title",   // 回答一覧の surveyId 外部キー表示に使う
});

export const surveyMutations = createCollectionMutations(surveysCollection, {
  softDelete: () => ({ deletedAt: new Date() }),
  restore:    () => ({ deletedAt: null }),
  close:      () => ({ status: "closed" as const }),
  reopen:     () => ({ status: "published" as const }),
  // publish は revision インクリメントを伴うため mutation（引数なし固定値）では
  // 表現できない。ページ側で現在値を読み updateDoc する（8.2 参照）
});

export const surveyQueries = createCollectionQueries(surveysCollection, {
  active:    () => ({ where: [{ field: "deletedAt", operator: "==" as const, value: null }] }),
  deleted:   () => ({
    where: [{ field: "deletedAt", operator: "!=" as const, value: null }],
    orderBy: [{ field: "deletedAt", direction: "desc" as const }],
  }),
  published: () => ({ where: [
    { field: "deletedAt", operator: "==" as const, value: null },
    { field: "status", operator: "==" as const, value: "published" },
  ] }),
});
```

### 5.2 responses(回答)— アンケートと同階層

```
/workspaces/:workspaceId/responses/:responseId
```

```ts
// shared/survey/collections/response.ts（スケッチ）
const responseDataSchema = z.object({
  surveyId: zf.string().register(zf.externalKey.registry, {
    label: "アンケート",
    externalKeyConfig: {
      type: "firestore",
      reference: surveysReference,
      contextId: "workspace",
      getQuery: () => surveyQueries.queries.active(),
    },
    width: 180,
  }),
  surveyRevision: zf.number().register(zf.number.registry,
    { label: "回答時の版", readOnly: true, width: 90 }).optional(),
  respondentId: zf.string().register(zf.externalKey.registry, {
    label: "回答者",
    externalKeyConfig: {
      type: "firestore",
      reference: membersReference,      // taskManager の members を共用
      contextId: "workspace",
      getQuery: () => memberQueries.queries.all(),
    },
    width: 140,
  }).optional(),
  answers: z.record(zf.string(), z.unknown())
    .register(zf.record.registry, { label: "回答" }),
}).register(zf.object.registry, {});

const responseCreateExcludedSchema = z.object({
  submittedAt: zf.date().register(zf.date.registry,
    { label: "回答日時", readOnly: true, width: 130 }).optional(),
  createdAt: zf.date().register(zf.date.registry, { label: "作成日", readOnly: true }).optional(),
  updatedAt: zf.date().register(zf.date.registry, { label: "更新日", readOnly: true }).optional(),
});

export const responsesCollection = collectionConfig({
  path: "/workspaces/:workspaceId/responses/:responseId" as const,
  fieldKeys: [] as const,
  schema: responseDataSchema,
  createExcludedSchema: responseCreateExcludedSchema,
  onCreate: () => ({ createdAt: new Date(), submittedAt: new Date() }),
  onWrite:  () => ({ updatedAt: new Date() }),
});

export const responseQueries = createCollectionQueries(responsesCollection, {
  all:      () => ({}),
  bySurvey: (surveyId: string) => ({
    where: [{ field: "surveyId", operator: "==" as const, value: surveyId }],
  }),
});
```

**設計上の要点（要求仕様 3 の実現方法・確定）**

- surveys と responses は**兄弟コレクション**。responses の `surveyId` は
  **通常のスキーマフィールド + named query**（`bySurvey`）とする
- **`fieldKeys: ["surveyId"]`（nonPathKeys）にはしない（調査済み・確定）**:
  nonPathKeys は `documentIdentityKeys = documentPathKeys + nonPathKeys` として
  **識別キーの必須要素**になり、autoQuery で常に `surveyId ==` が付与される
  （`packages/zod-firebase/README.ja.md` の nonPathKeys / autoQuery 節）。
  「surveyId 指定なしの横断クエリ」がアクセサの型上不可能になるため、
  横断検索要件と両立しない
- `surveyId` / `respondentId` は externalKey として貼り、一覧でアンケート名 /
  回答者名が自動解決される（tasks の `assigneeId` と同一パターン）
- `respondentId` には回答時にログインユーザーの member docId（= email。
  members の `onCreateId` 仕様）を自動設定する
- responses は**作成のみで更新・削除 UI を持たない**（MVP）。論理削除規約も適用しない
- `answers` のキーは SurveyFieldDef の `id`（6 章）。値は `z.unknown()` で受け、
  解釈は表示側（9 章）で行う

### 5.3 firestore.indexes.json への追加

useGrowingList（orderBy + ストリーム）と bySurvey 絞り込みの組み合わせに対応する:

| collectionGroup | fields |
| --- | --- |
| surveys | (deletedAt ASC, createdAt DESC, __name__ DESC) / (deletedAt ASC, updatedAt ASC, __name__ ASC) |
| surveys | (deletedAt ASC, status ASC, createdAt DESC, __name__ DESC) / (…, updatedAt ASC, …) |
| responses | (surveyId ASC, submittedAt DESC, __name__ DESC) / (surveyId ASC, updatedAt ASC, __name__ ASC) |

（横断一覧の `orderBy submittedAt desc` 単独は単一フィールドのため不要。
エミュレータはインデックス強制がないため、実機デプロイ時の再現性のために入れておく）

---

## 6. フィールド定義 DSL

### 6.1 型と メタスキーマ（fieldDefs.ts）

MVP のフィールド種別は 6 種。**discriminatedUnion の配列**として保存する。
DSL 自体を zf メタスキーマで定義することで、
**「フィールド定義を編集するフォーム」も AutoForm で自動生成される**（メタスキーマのデモ）。

```ts
// 共通 shape（全種別に含める）
const fieldBaseShape = {
  type: z.literal(...).register(zf.literal.registry, { hidden: true }),
  // id は回答（answers のキー）との対応に使う内部識別子。
  // hidden + .default(() => generateFieldId()) にすることで、
  // 種別選択時に自動採番される（下記 6.3 の調査結果により成立）
  id: zf.string().register(zf.string.registry, { hidden: true })
       .default(() => generateFieldId()),
  label: zf.string().min(1).register(zf.string.registry, { label: "質問文" }),
  required: zf.boolean().register(zf.boolean.registry,
    { label: "必須", uiType: "checkbox" }).default(false),
};

export const surveyFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...fieldBaseShape("text"),
    placeholder: zf.string().register(zf.string.registry, { label: "プレースホルダ" }).optional(),
  }).register(zf.object.registry, { label: "短文テキスト" }),
  z.object({ ...fieldBaseShape("multiline") })
    .register(zf.object.registry, { label: "長文テキスト" }),
  z.object({ ...fieldBaseShape("number"),
    min: zf.number().register(zf.number.registry, { label: "最小値" }).optional(),
    max: zf.number().register(zf.number.registry, { label: "最大値" }).optional(),
  }).register(zf.object.registry, { label: "数値" }),
  z.object({ ...fieldBaseShape("select"),
    options: zf.array(
      z.object({
        value: zf.string().register(zf.string.registry, { hidden: true })
                .default(() => generateFieldId()),
        label: zf.string().min(1).register(zf.string.registry, { label: "選択肢" }),
      }).register(zf.object.registry, { uiType: "horizontal" }),
    ).min(1).register(zf.array.registry, { label: "選択肢", discriminator: "value" }),
  }).register(zf.object.registry, { label: "単一選択" }),
  z.object({ ...fieldBaseShape("boolean") })
    .register(zf.object.registry, { label: "チェック（はい/いいえ）" }),
  z.object({ ...fieldBaseShape("date") })
    .register(zf.object.registry, { label: "日付" }),
]).register(zf.union.registry, {
  selectorLabel: "質問の種類",
  unselectedLabel: "種類を選択…",
});

export const surveyFieldsSchema = zf.array(surveyFieldSchema)
  .register(zf.array.registry, { label: "質問", discriminator: "id" })
  .default([]);

export type SurveyFieldDef = z.infer<typeof surveyFieldSchema>;
```

実装注意:
- `fieldBaseShape` はスケッチ。実際は「type literal を引数に取るヘルパ関数」か
  各アームで素直に書き下す（`pages/form/schemas/discriminatedUnion.ts` が
  discriminatedUnion + メタ登録の正準例）
- `generateFieldId()` は `crypto.randomUUID().slice(0, 8)` 程度の短縮 ID
- Firestore は `undefined` を保存できないため、保存前に AutoForm の出力を
  そのまま渡してよいか確認する（optional 未入力は `undefined` → accessor の
  transform で落ちるか要確認。問題があれば保存前に JSON 正規化）

### 6.2 ビルダーでの編集 UI が成立する根拠（調査済み）

以下はすべて **zod-form-mantine の現行実装で確認済み**。カスタムウィジェットなしで
フィールド定義エディタが成立する:

1. **配列への項目追加**: array コンポーネントの「+」は
   `getDefaultValue(itemSchema)` を試み、union では undefined になるため
   **「種類未選択」の項目が追加され、union セレクタ（`unselectedLabel`）が出る**
   （`array.tsx` の `getArrayItemDefaultValue` / `append`）
2. **種類選択で初期値が入る**: union セレクタで arm を選ぶと
   `getDefaultValue(profile.schema)` がマージされる（`union.tsx` の `handleSelect`）。
   これにより **`.default(() => generateFieldId())` の `id` 自動採番が発火**し、
   `required: false` などのデフォルトも入る
3. **種類を切り替えても id が保持される**: arm 切替時は
   `{...defaults, ...stripPropertiesOutsideArm(currentValue, arm)}` の順でマージされ、
   全アーム共通の `id` / `label` / `required` は現在値が優先される
4. **並べ替え**: array は dnd-kit による DnD 並べ替えを標準装備。
   `discriminator: "id"` メタで安定キーが効く
5. **選択肢（select の options）**: ネスト配列も同じ仕組みで追加/削除/並べ替え可能

### 6.3 buildSurveySchema（ランタイムビルダー）

```ts
// shared/survey/buildSurveySchema.ts
export type BuildSurveySchemaResult = {
  schema: z.ZodObject<z.ZodRawShape>;   // answers 用スキーマ（キーは field.id）
  warnings: string[];
  fieldErrors: { id: string; message: string }[];
};
export function buildSurveySchema(fields: unknown): BuildSurveySchemaResult;
```

変換表（DSL → zf）:

| type | 生成スキーマ | メタ |
| --- | --- | --- |
| text | `zf.string()`（required なら `.min(1)`、それ以外 `.optional()`） | label, placeholder は suggestions ではなく Mantine 側未対応のため label に含めない（将来 uiType 拡張） |
| multiline | `zf.string()` | `uiType: "multiline"` |
| number | `zf.number()` + min/max | label |
| select | `zf.enum(options から literal 生成)` | 各 literal に `label`、enum に `label` |
| boolean | `zf.boolean()`（required は `z.literal(true)` + boolean 強制。`basicInput.ts` の `isConfirmed` パターン） | `uiType: "checkbox"` |
| date | `zf.date()` | label |

堅牢性（aibpo-core 実証パターンの一般化）:

- 入力 `fields` は**まず `surveyFieldsSchema.safeParse` で 1 件ずつ検証**し、
  壊れた要素だけ `fieldErrors` に落とす。パースできた要素のみスキーマ化
- 復元不能な要素の位置には `zf.common()` ベースの**エラーセンチネル**
  （`label: "表示できない質問"`, `readOnly: true` のプレースホルダ）を挿入し、
  **フォーム全体の描画は継続**する
- `id` 重複や select の options 空は `warnings` に載せる（描画は継続）
- 純関数・React 非依存で実装し、**vitest 単体テストを必須**とする:
  正常系 6 種 / required 反映 / 不正要素混入（フィールド単位で落ちる）/
  空配列 / options 空 / id 重複 / fields が配列でない

---

## 7. Firestore ルール（firestore.rules への追加）

`match /workspaces/{workspaceId}` ブロック内に追加（既存ヘルパをそのまま使用）:

```
// surveys サブコレクション
match /surveys/{surveyId} {
  allow read: if isMember(workspaceId) || isWorkspaceOwner(workspaceId);
  allow write: if canWriteTask(workspaceId) || isWorkspaceOwner(workspaceId);
}

// responses サブコレクション（回答は作成のみ。改竄防止のため update/delete は admin）
match /responses/{responseId} {
  allow read: if isMember(workspaceId) || isWorkspaceOwner(workspaceId);
  allow create: if isMember(workspaceId) || isWorkspaceOwner(workspaceId);
  allow update, delete: if isAdmin(workspaceId) || isWorkspaceOwner(workspaceId);
}
```

`apps/web/tests/firestore.rules.test.ts` に追加するケース（既存 29 件と同じ流儀）:

- member は survey を作成/読める、viewer は読めるが作成できない
- member は response を作成できる、作成後に member は更新できない（admin は可）
- outsider は surveys / responses を読めない

---

## 8. 画面仕様

### 8.1 ワークスペース一覧（/survey/workspaces）

- `taskManager-top/workspaces.tsx` を雛形にした survey 専用ページ
  （`useUserWorkspaces` / `WorkspaceCreate` ウィザードは **import で共用**）
- 相違点はアクション列の遷移先（`surveysRoute`）のみ
- 列設定 tableKey は taskManager と共有しない（`"survey-workspace"`）

### 8.2 アンケート一覧（/survey/workspaces/:wid/surveys）

`tasks.tsx` を雛形にする（ヘッダ / メニュー / ゴミ箱 SegmentedControl / コード表示）。

- 一覧: `useList`（アンケート数は多くない想定。`active()` + orderBy createdAt desc）
  - 列: title / status(badge) / revision / 回答数? は集計になるためスコープ外 /
    createdAt / updatedAt / _action（extendSchemaSafe + createActionSchema →
    ビルダーへ）
- 新規作成: モーダル + `AutoForm`（createSchema, `onInit()`）→ 作成後
  `navigate` でビルダーへ
- 行メニュー相当の操作はビルダー側に寄せ、一覧のメニューは
  「列設定 / サンプルアンケート追加」のみ
- 複製: ビルダー内アクション（8.3）として提供（一覧側には置かない。シンプル優先）
- ゴミ箱ビュー: tasks と同じ（`deleted` query + 復元列 + 楽観的除外）

### 8.3 ビルダー（/survey/workspaces/:wid/surveys/:sid）★中核

**2 カラム構成（設定 + ライブプレビュー）**。狭幅（`md` 未満）では縦積み。

```
Container size="xl"
├ ヘッダ: Title「アンケート編集」 + status Badge + codeViewerTrigger + Menu
│   Menu: 複製 / 終了(close) / 再公開(reopen) / ゴミ箱へ
├ Grid
│  ├ Grid.Col span={{base:12, md:6}}  … 左: 設定フォーム（手組み）
│  └ Grid.Col span={{base:12, md:6}}  … 右: ライブプレビュー
└ アクションバー（左カラム下）: 変更を破棄 / 下書き保存 / 公開する
```

**左カラム（設定フォーム）— 手組み方式で確定**

AutoForm はフォーム値の外部購読手段を持たないため（調査済み）、ビルダーは
`@zodapp/zod-form-react` の基盤 API で手組みする。これ自体が
**FormProvider + Switch + useFormValues の実演**（露出ゼロだった API 群）になる:

```tsx
// AutoForm.tsx の内部実装（調査済み）を踏襲した骨格
const editorSchema = hideSchemaFields(surveysCollection.updateSchema, { paths: ["status"] });
const validator = editorSchema as StandardSchemaV1<z.input<typeof editorSchema>, unknown>;
const form = useZodForm({
  defaultValues: survey,          // useDoc の item
  validators: { onChange: validator, onBlur: validator, onSubmit: validator },
  onSubmit: ({ value }) => saveDraft(value),
});
…
<ZodFormContextProvider merge componentLibrary={componentLibrary} resolverContext={...}>
  <FormProvider form={form}>
    <ValidatePrecedingFieldsProvider>
      <Switch fieldPath="" schema={editorSchema} />
    </ValidatePrecedingFieldsProvider>
    <BuilderActions form={form} …/>      // 下記
  </FormProvider>
</ZodFormContextProvider>
```

- `componentLibrary` は `@zodapp/zod-form-mantine` の `componentLibrary` を明示的に渡す
  （手組みの場合 AutoForm のデフォルト注入が効かないため必須）
- status はフォームから隠し、ヘッダの Badge + メニュー/公開アクションで制御する

**右カラム（ライブプレビュー）**

```tsx
const values = useFormValues<z.input<typeof editorSchema>>();   // FormProvider 配下で購読
const { schema, warnings, fieldErrors } = useMemo(
  () => buildSurveySchema(values.fields ?? []),
  [values.fields],
);
<AutoForm key={hash(values.fields)} schema={schema} showPreview={false} />
```

- プレビューは**編集中（未保存）の値**から再構築する。`useFormValues` は
  FormProvider 配下でしか使えないため、右カラムは FormProvider の内側に置く
  （Grid ごと FormProvider で包む構成にする）
- `key` に fields のハッシュ（`stableStringify` を `@zodapp/caching-utilities` から
  利用可）を渡して、スキーマが変わったらフォーム状態をリセットする
- 送信ボタンは出さない（`actions: []` を渡す）。`warnings` / `fieldErrors` は
  プレビュー上部に `Alert` で表示
- 再構築頻度が問題になる場合のみ `useDeferredValue` で遅延（初手では入れない）

**アクションバー（AutoFormAction の手動レンダリング）**

手組みフォームでは AutoForm の `actions` prop が使えないため、
`createAutoFormSubmitAction` / `createAutoFormResetAction` /
`createAutoFormButtonAction`（`@zodapp/zod-form-widget/form`）で
ActionComponent を作り、`{ form, handleSubmit, isLoading }` を渡して自前で並べる
（AutoForm 内部の `normalizedActionComponents.map(...)` と同じ呼び出し形。調査済み）。
`handleSubmit` は AutoForm 内部実装と同様に `form.handleSubmit()` + バリデーション
結果の Promise 化で用意する。

- 変更を破棄: reset action、`disabled: ({formState}) => formState.isDefaultValue`
- 下書き保存: submit action（`updateDoc`。status は変更しない）
- 公開する: button action、
  `disabled: ({formState}) => !formState.isDefaultValue`（未保存変更があるうちは不可）。
  実行内容: `updateDoc(identity, { status: "published", revision: (survey.revision ?? 0) + 1, publishedAt: new Date() })`
- published 状態で fields に未保存変更がある場合、アクションバー付近に
  「公開中のアンケートです。保存すると回答者に即時反映されます」の `Alert` を出す
  （revision は publish 時のみ上がる。完全なスナップショット分離は将来スコープ）

**データ購読**: `useDoc({ collection: surveysCollection, documentIdentity })`。
form の defaultValues には**初回取得値**を使い、購読更新でフォームをリセットしない
（taskManager の編集ページと同じ挙動）。

### 8.4 回答フォーム（/survey/workspaces/:wid/surveys/:sid/answer）

- `useDoc` で survey を購読。`status !== "published"` は案内 `Alert` のみ表示
- `buildSurveySchema(survey.fields)` → `AutoForm`（通常の onSubmit 型）
- onSubmit:
  ```ts
  responseAccessor.createDoc({ workspaceId }, {
    surveyId, surveyRevision: survey.revision,
    respondentId: user.email,          // members の docId 規約（onCreateId）と一致
    answers: data,                      // buildSurveySchema の出力そのまま
  });
  ```
  ※ answers 内の `undefined`（未入力 optional）と `Date` の Firestore 変換は
  accessor の transform に任せる。undefined が保存エラーになる場合は
  createDoc 前に除去する（P4 で確認）
- 送信後: サンクス表示 + 「もう一度回答する」「回答一覧を見る」
- ビルダーのヘッダから「回答ページを開く」リンクを付ける

### 8.5 回答一覧（/survey/workspaces/:wid/responses）★横断検索

`tasks.tsx` を雛形にした一覧ページ:

- `useGrowingList`（streamField: "updatedAt"、orderBy submittedAt desc）
- **検索**（AutoSearch + URL searchParams。tasks.route.ts と同じ `q` 規約）:
  ```ts
  const searchFilterSchema = zf.object({
    surveyId: zf.string().register(zf.externalKey.registry, {
      label: "アンケート",
      externalKeyConfig: { type: "firestore", reference: surveysReference,
        contextId: "workspace", getQuery: () => surveyQueries.queries.active() },
    }).nullable().optional(),
    submittedAt: zf.object({
      $gte: zf.date().register(zf.date.registry, { label: "回答日（From）" }).optional(),
      $lte: zf.date().register(zf.date.registry, { label: "回答日（To）" }).optional(),
    }).register(zf.object.registry, { uiType: "horizontal-wrap" }).optional(),
  }).register(zf.object.registry, { uiType: "horizontal-wrap" });
  ```
  - surveyId は **Firestore where（`bySurvey`）**に反映（横断⇔絞り込みが 1 画面）
  - submittedAt 範囲はクライアント mingo（tasks と同じ分担。
    サーバ絞り込みへの拡張は tasks の filterMode デモに委ねる）
- **answers 列（2 モード。9 章の調査結果に基づく設計）**
- CSV エクスポート: `useExportModal` + `useExportFetchAll`（既存パターン）
- 回答は編集しない（詳細ページなし。行アクション列も MVP では省略可）

---

## 9. answers 列の表示設計（record 動的列の実演）

### 9.1 ライブラリの実挙動（調査済み）

- `zf.record` のフィールドは列設定ドロワーで **record テンプレート**
  （`answers.*`）として扱われ、**ユーザーがキー文字列を入力すると
  `answers.<キー>` の具体列を追加できる**（`TableSettingDrawer.tsx` の
  `buildFieldOptionsForColumn` + `resolveRecordTemplateConcretePath`）
- 列ヘッダは「record の label + キー」（`resolveRecordTemplateLabel`）。
  **データから列が自動生成されるわけではない**

### 9.2 2 モードの列構成（確定）

**(a) 横断モード（surveyId フィルタなし）**

- テーブルスキーマ: `responsesCollection.dataSchema` +
  `_action` 等はなし。answers は record のまま
- 既定列: surveyId / respondentId / surveyRevision / submittedAt
- answers の個別列が欲しい上級者は、列設定ドロワーでキー（fieldId）を入力して
  record テンプレート列を追加できる（これが record 動的列の素の実演になる）

**(b) アンケート絞り込みモード（q.surveyId あり）**

- 対象 survey を `useDoc` で取得し、
  `buildSurveySchema(survey.fields).schema` を **`extendSchemaSafe` で
  `answers` キーに上書き**した実スキーマをテーブルスキーマにする:
  ```ts
  const tableSchema = extendSchemaSafe(responsesCollection.dataSchema, {
    answers: builtAnswersSchema.optional(),
  });
  ```
  （extendSchemaSafe は**既存キーの上書きのみ許可**するヘルパなのでこの用途に適合。調査済み）
- これにより answers 配下が**ネストオブジェクト列**（`answers.<fieldId>`）として
  展開され、**列ヘッダに DSL の質問文（label）が乗る**
- 既定列: respondentId / submittedAt / `answers.<fieldId>` × 全質問
- **列設定コントローラの注意（調査済み）**: `useColumnSettingsProfileController` は
  初回ロードを ref でガードしているため、**tableKey / スキーマが変わっても
  プロファイル一覧を再ロードしない**。モード(b) のテーブル+コントローラは
  `key={q.surveyId ?? "all"}` で**コンポーネントごと remount**する

### 9.3 列設定 tableKey

| テーブル | tableKey |
| --- | --- |
| survey ワークスペース一覧 | `survey-workspace` |
| アンケート一覧 | `survey` / ゴミ箱: `survey-trash` |
| 回答一覧（横断） | `response` |
| 回答一覧（survey 絞り込み） | `response:<surveyId>` |

---

## 10. E2E シナリオ（Playwright + エミュレータ）

既存デモと同じ手順で自動化する（メール認証・`/opt/pw-browsers/chromium`）:

1. サインアップ → taskManager workspaces に着地 → トップナビ「アンケートデモ」
2. （workspaces 空なら）ワークスペース作成ウィザード
3. アンケート作成 → ビルダーへ遷移
4. 質問を追加（+ → 種類「短文テキスト」選択 → 質問文入力。
   さらに「単一選択」を追加し選択肢 2 件入力）
5. **右プレビューに質問がライブ反映されることを確認**（ラベル文字列の出現）
6. 下書き保存 → 「公開する」が有効化 → 公開（status Badge が「公開中」に）
7. 「回答ページを開く」→ 回答入力 → 送信 → サンクス表示
8. 回答一覧（横断）で 1 件表示、アンケート名が外部キー解決されている
9. アンケートで絞り込み → answers 列が質問文ヘッダで展開されている
10. CSV エクスポートのモーダルが開く（ダウンロードはモーダル表示まで）

検証コマンド（確立済み）:

```bash
npx firebase emulators:start --only auth,firestore,storage --project demo-zodapp
cd apps/web && VITE_FIREBASE_EMULATOR=1 pnpm dev     # localhost:3000
pnpm emulator:test                                    # ルールテスト込み全テスト
```

---

## 11. 実装フェーズ（コミット粒度と Definition of Done）

| フェーズ | 内容 | DoD |
| --- | --- | --- |
| P1 データ層 | `shared/survey/`（fieldDefs / collections / buildSurveySchema + 単体テスト）、firestore.rules + ルールテスト、indexes | `pnpm emulator:test` 全緑。UI なし |
| P2 骨格 | ルート一式 / Layout ×2 / セクション redirect / トップナビ追加 / ワークスペース一覧 / アンケート一覧（作成→遷移、ゴミ箱、シード） | 一覧 CRUD が emulator 上で動作。check-types / build 緑 |
| P3 ビルダー | 手組みフォーム + ライブプレビュー + アクションバー（破棄/保存/公開）+ 複製/close/reopen メニュー | E2E 手順 3〜6 相当を Playwright で確認 |
| P4 回答フロー | 回答フォーム / 回答一覧（横断 + 絞り込み + answers 列 2 モード + CSV） | E2E 手順 7〜10 相当を確認。undefined/Date 保存問題の解消を含む |
| P5 仕上げ | E2E 一巡の再実行、AGENT.md 逆引き追記（「ランタイムスキーマ生成」「record 動的列」「手組みフォーム」）、README 追記 | build / check-types / emulator:test / E2E 全緑 |

各フェーズ完了時に `pnpm --filter web check-types` / `pnpm build` /
`pnpm emulator:test` を通してからコミットする（このブランチの慣例）。

---

## 12. 決定事項と残る注意点

### 決定済み（本詳細版で確定）

| # | 論点 | 決定 |
| --- | --- | --- |
| 1 | テナント基盤 | taskManager の workspaces / members / useUserWorkspaces / WorkspaceCreate を import 共用。改名リファクタはしない |
| 2 | ライブプレビュー | 手組み（useZodForm + FormProvider + Switch + useFormValues）。AutoForm の内部実装を踏襲。ライブラリへの `onValuesChange` 追加はしない |
| 3 | ログイン | taskManager のログイン画面・AuthGuard を共用。survey 用リダイレクト記憶はスコープ外 |
| 4 | surveyId の持ち方 | 通常フィールド + named query。fieldKeys(nonPathKeys) は不採用（autoQuery が横断検索と型レベルで両立しないため） |
| 5 | 公開後編集 | revision 記録 + published 中の編集警告のみ。スナップショット分離は将来 |
| 6 | 回答の編集/削除 | UI なし（ルール上も member は不可・admin のみ） |
| 7 | answers 列 | 横断= record テンプレート（手動キー追加）、絞り込み= extendSchemaSafe で実スキーマに差し替え |
| 8 | ルート/名称 | `/survey`、トップナビ表示名「アンケートデモ」（IconClipboardList） |

### 実装時に確認が必要な点（設計は決定済み・挙動確認のみ）

1. **answers の `undefined` / `Date` の保存**: optional 未入力（undefined）が
   Firestore 書き込みでエラーにならないか。なる場合は createDoc 前に除去
   （`useProfileColumnSettings.ts` の `sanitizeColumns` と同様の処理）
2. **fields 配列の AutoForm 出力形**: DnD 後の並び・default 適用後の形が
   `surveyFieldsSchema.parse` を通ること（P3 で単体確認）
3. **手組みフォームでの `hasDirtyPreview` 相当**: `formState.isDefaultValue` が
   defaultValues 差し替えなしで期待どおり動くこと（AutoFormAction の
   resolverContext 経由。formActions デモで実証済みだが手組み側でも確認）
4. **record テンプレート列と extendSchemaSafe 上書きの共存**: モード(b) では
   answers が record でなくなるためテンプレート入力 UI は出ない（想定どおりで OK か
   ドロワーを目視確認）

---

## 13. スコープ外（将来）

- 分析機能（集計・グラフ）。responses が兄弟コレクション + record answers なので、
  集計クエリ / クライアント集計のどちらにも進める
- 匿名・外部公開回答（公開リンク、Anonymous Auth。rules 追加のみで拡張可能な構造）
- 公開スナップショットを分離する完全なバージョニング
- 回答の下書き保存・編集、回答数の集計列、通知

---

## 14. 参考（調査で参照した実装）

- ルーティング 3 層構造: `apps/web/src/pages/router.tsx`,
  `taskManager-top/index.route.ts` / `layout.route.ts` / `index.tsx`
- レイアウトと認可: `taskManager-{top,workspace,project}/Layout.tsx`,
  `components/CommonLayout.tsx`, `shared/auth/AuthGuard.tsx`,
  `pages/top/Layout.tsx`（トップナビ）
- 一覧ページ慣例: `taskManager-project/tasks.tsx`（ヘッダ / 検索 Box / ゴミ箱 /
  シード / CSV / 列設定）, `taskManager-workspace/projects.tsx`
- AutoForm 内部（手組みの雛形）: `packages/zod-form-widget/src/form/AutoForm.tsx`
  （useZodForm + validators + FormProvider + Switch + アクション正規化）
- union 配列編集の挙動: `packages/zod-form-mantine/src/components/array.tsx`
  （append = getDefaultValue）, `union.tsx`（handleSelect の default マージ、
  `stripPropertiesOutsideArm`）, `packages/zod-form/src/utils/default.ts`
- record 動的列: `packages/zod-form-widget/src/table/extract-schema-columns.ts`,
  `TableSettingDrawer.tsx`（`resolveRecordTemplateConcretePath` ほか）
- discriminatedUnion のメタ登録の正準例: `apps/web/src/pages/form/schemas/discriminatedUnion.ts`
- nonPathKeys / autoQuery 仕様: `packages/zod-firebase/README.ja.md`
- aibpo-core の該当実装（クローズドのためコードは移植せずパターンのみ参照）:
  DSL → スキーマ構築の 3 分割戻り値、エラーセンチネル、2 カラムビルダー構成
