# enum の badge 表示：選択済みの値もバッジにするプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-2d9cdh`（このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/zod-form-mantine-lite`、`@zodapp/zod-form-mantine`（利用側: `apps/form-demo`、`apps/taskmanager`）

---

## 1. 背景と原因

taskmanager のタスク一覧の絞り込み（`tasks.route.ts` の `searchFilterSchema.status`、`uiType: "badge"`）で、
ドロップダウンの選択肢はバッジで出るのに、選択済みの値は素の文字で出る。

enum の部品は Mantine の `Select` に `renderOption={uiType === "badge" ? renderSelectOption : undefined}` を
渡しているだけで、`renderOption` はドロップダウンの各行にしか効かない。
Mantine 9.6.3 の `Select` は入力欄が `<input>` で、選択済みの値の描画を差し替える props がない。

同じ作りの箇所は次の 4 つ。

| 箇所 | 現状 |
| --- | --- |
| `zod-form-mantine/src/components/enum.tsx`（AutoForm / AutoSearch） | 選択済みは文字 |
| `zod-form-mantine-lite/src/reactiveComponents/enum.tsx`（ReactiveAutoForm） | 選択済みは文字 |
| 上記 2 つの読み取り専用表示（`ReadonlyText`） | 文字のみ |
| `zod-form-mantine/src/components/array_multipleEnum.tsx`（`uiType: "multipleEnumBudge"`） | 選択済みは素のピル |

あわせて、現状の `Select`（searchable）は、選択済みの状態で開いて打ち込むと
「進行中進」のように既存の文字に足されてしまう。

## 2. 決めた仕様

ユーザーとの対話で次のように決めた（比較スクショ: 案(1)・案(2)・現状）。

1. **badge の enum は Combobox で組んだ専用の部品にする（案(2)）。**
   - 閉じている間：入力欄の位置に、選択済みの値を `Badge`（`variant="light"`、選択肢の `color`、既定 `gray`）で出す。
   - ドロップダウンを開いている間（フォーカス・クリック・打ち込み）：入力欄を文字入力に切り替え、
     選択済みの値のラベルを placeholder（薄い文字）で出す。入力した文字でラベルと値を部分一致で絞り込む。
     入力欄は空から始まるので、既存の文字に足されることはない。
   - 選ぶか閉じると、フォーカスが残っていてもバッジに戻す（実装時に、選んだ直後に薄い文字だけになり
     選べていないように見えたため、切り替えの条件をフォーカスからドロップダウンの開閉に変えた）。
   - クリアボタン（×）で値を消せる。値がないときはシェブロンを出す。
   - ドロップダウンの各行は、今と同じ `renderSelectOption` の見た目（選択中にチェック＋バッジ）。
2. **読み取り専用表示もバッジにする。** 値がないときは今と同じく空。
3. **複数選択もバッジにする。** `MultiSelect` の `renderPill` で、選択済みのピルを `Badge`（× で外せる）にする。
4. **`multipleEnumBudge` を `multipleEnumBadge` に改名する。** 旧綴りの互換は残さない（破壊的変更として CHANGELOG に書く）。

badge 以外の enum（`uiType` なし）は今の `Select` のまま変えない。

## 3. 設計

### 3.1 共通部品 `BadgeSelect`（`zod-form-mantine-lite/src/utils/badgeSelect.tsx`）

TanStack Form に依存しない、制御コンポーネントとして作る。通常版と reactive 版の両方から使う。

```ts
type BadgeSelectProps = {
  value: string | null;              // toEnumOptionValue 済みの値
  data: OptionDataType[];            // useEnumData の結果（disabled を含められる）
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  label?: string;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;              // 値がないときの placeholder
  rightSection?: React.ReactNode;    // reactive 版の確定・取消ボタン用（未指定ならクリア／シェブロン）
  rightSectionWidth?: number;
  style?: React.CSSProperties;
  inputRef?: React.Ref<HTMLInputElement>;
};
```

- `useCombobox` ＋ `Combobox.Target` に `InputBase`（`<input>`）。
- `value` があってドロップダウンが閉じている間は、入力欄の左にバッジを重ねる
  （`InputBase` の `inputContainer` の中に `pointer-events: none` の絶対配置。入力欄の文字は空）。
- 検索文字は部品内の state。開くたび・閉じるたびに空に戻す。
- `Combobox.Option` に `disabled` を渡す（`unlisted: "keep"` の「（不正な値）」を選べないまま表示するため）。
- キーボード：上下で移動、Enter で確定、Esc で閉じる（Mantine の Combobox 標準の操作に任せる）。
- 一致する選択肢がないときは `Combobox.Empty` に「見つかりません」。

### 3.2 読み取り専用のバッジ表示

`zod-form-mantine-lite/src/utils/selectOption.tsx` に、ラベルと色からバッジを返す小さな関数
（例: `renderBadge(option)`）を足し、`renderSelectOption`・`BadgeSelect`・読み取り専用表示・`renderPill` で共有する。
読み取り専用表示は、`uiType === "badge"` のとき `ReadonlyText` の代わりにこのバッジを出す。

### 3.3 各部品の変更

- **`zod-form-mantine/src/components/enum.tsx`**：`uiType === "badge"` のとき `Select` の代わりに `BadgeSelect` を使う。
  `unlisted`（clear / keep）、選択肢 0 件の表示、エラー文言、`WithValueAction` の扱いは今のまま共通のロジックを通す。
- **`zod-form-mantine-lite/src/reactiveComponents/enum.tsx`**：同様に `BadgeSelect` を使い、
  `confirmableRightSectionProps` の確定・取消ボタンを `rightSection` で渡す。
- **`zod-form-mantine/src/components/array_multipleEnum.tsx`**：`uiType === "multipleEnumBadge"` のとき
  `renderOption` に加えて `renderPill` でバッジを出す。読み取り専用表示もバッジを並べる。
  バッジの × は、Mantine の Pill の削除ボタンと同じく mousedown / click を PillsInput へ伝えない
  （伝えるとクリックで外せない）。
- **`zod-form-mantine/src/components/index.ts`**：`array_multipleEnumBudge` を `array_multipleEnumBadge` に改名。
- `zod-form-mantine-lite/src/utils/index.ts` から `BadgeSelect` を export する。

### 3.4 利用側

- `apps/form-demo/src/pages/form/schemas/enumSelect.ts`：`multipleEnumBudge` を `multipleEnumBadge` に（ラベルの文言も）。
- taskmanager は `uiType: "badge"` をそのまま使うので変更なし（タスク一覧の絞り込み、タスクの作成・編集フォームに効く）。

## 4. テスト

- `BadgeSelect` の単体テスト（Vitest + Testing Library）。Testing Library が devDependencies にある
  `zod-form-mantine` に置く（`src/components/badgeSelect.spec.tsx`）
  - 閉じている間はバッジが出て、入力欄の文字は空
  - フォーカスすると placeholder に選択済みのラベルが出て、打ち込むと絞り込まれる（「進行中進」にならない）
  - 選択肢を選ぶと `onChange` が値で呼ばれる／× で `null`
  - `disabled` の選択肢は選べない
- `apps/form-demo` の e2e（spec は 1 つのデモページに 1 つなので、zf.enum のデモ用に `enum-select.spec.ts` を新設）
  - badge の enum：選択後にバッジが出る、フォーカスして検索して選び直せる、クリアできる
  - `multipleEnumBadge`：選択済みがバッジで出て、× で外せる
- `pnpm check-types`・`pnpm build`・既存のテストが通ること。

## 5. ドキュメント

- `CHANGELOG.md` / `CHANGELOG.ja.md`（未リリース）に追記：
  - badge の enum で選択済みの値・読み取り専用表示もバッジで出すようにした（フォーカス中は文字入力で検索）
  - 複数選択の badge で選択済みもバッジで出すようにした
  - **破壊的変更**：`uiType: "multipleEnumBudge"` を `"multipleEnumBadge"` に改名
- `uiType` を説明している README 等があれば、改名を反映する。

## 6. 実装の順序（コミットの粒度）

1. `renderBadge` と `BadgeSelect`（＋単体テスト）
2. 通常版 enum・reactive 版 enum を `BadgeSelect` に切り替え、読み取り専用表示をバッジに
3. 複数選択の `renderPill`・読み取り専用表示、`multipleEnumBadge` への改名（form-demo を含む）
4. e2e の追加
5. CHANGELOG・ドキュメント
