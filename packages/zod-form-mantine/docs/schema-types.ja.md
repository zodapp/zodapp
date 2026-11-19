# zod の型ごとの描き方

部品は `componentLibrary` から、zf の名前（typeName）で探し、無ければ zod の型の名前（`schema.type`）で探します。どの型も `z.*` と `zf.*` のどちらで書いても同じに動きます。meta が無い（`z.*` で書いた）ときは既定の見た目で描き、meta があれば `label`・`uiType` などを使います。meta の文言は `useResolvedMeta` で読みます（`msgKey` で書いた label を訳すため）。

## 包む型

optional・nullable・default と同じく、包みを外して中を描きます（mantine-lite の `baseComponents`）。

| 型 | 描き方 |
|---|---|
| `.readonly()` | 中をそのまま描く。zod の readonly は値を凍らせるだけで入力の可否ではないので、読み取り専用の表示にはしない |
| `.catch()` | 中をそのまま描く。送信では parse が catch の値に置き換える |
| `.nonoptional()` | 中を必須として描く（外側の optional を打ち消す） |
| `.prefault()` | 中をそのまま描く。値が無ければ prefault の値が入る（[既定値](../../zod-form/docs/default-value.ja.md)） |
| `.pipe()`・`.transform()`・`z.codec()`・`z.stringbool()` | 入口（`def.in`）の schema で描く。検証は pipe 全体で行うので、値は入口の型でなければ通らないため。pipe に付いた検査は中に渡す。`z.stringbool()` は文字列の欄になる |

## 固定値

値が 1 つに決まる型（値が 1 つの literal、`z.null()`・`z.undefined()`・`z.void()`・`z.nan()`）は、既定で欄を出しません。値は開くときに既定値として入り（AutoForm）、部品からは書き込みません。

- meta で `hidden: false` を付けると、readOnly と同じ表示でスキーマの値を出します（`z.nan()` は「NaN」）。必須の印は付けません。null・undefined・void は中身が無いので出しません
- その欄にエラーがあれば、エラーだけを出します
- 入力できない表示なので、前の欄を検証するしくみ（`useValidatePrecedingFields`）には登録しません。登録すると、その手前の欄が入れ物の最後の欄でなくなるためです
- union の腕の中の discriminator も出なくなるので、選択欄と二重になりません
- `zf.boolean.registry` を付けた `z.literal(true)`（同意のチェック）は boolean の部品で描きます
- NaN の比較は `Object.is` で行います（literal の union の選択肢も同じ）。NaN は JSON にすると null になるので、`z.nan()` はフォームの中だけで使います

## 選択肢として選ぶ型

- **値が複数の literal**（`z.literal(["a", "b"])`）は enum の部品で描きます。`uiType` の `select`・`badge`、複数選択（`multipleEnum`）、`unlisted` も enum と同じです
- **enum の選択肢の名前**：object の形で書いた enum（`z.enum({ A: 1 })`、TS enum）は、label が無ければキーを名前にします。配列で書いた enum は値です。zod の検証を通らない値は選択肢から外します（数値の TS enum の逆引きのキーが消えます）。名前を自由に付けたいときは `zf.enum`・literal の union を使います（label が最優先）。enum・バッジ・複数選択・set・`union_select`、表の enum の列で同じ規則です

## 集まりの型

- **`z.set()`**：要素に TanStack Form のパスで欄を割り当てられないので、set 全体を 1 つの欄として描きます。要素が enum・literal の union・複数の値の literal なら MultiSelect、string・number なら TagsInput（重複は入らない）、それ以外は扱えない注記を出します。空の値は `emptyValueOf` にそろえ、要素のエラーもすべて set の欄に出します。値の比較（`isEqualValue`）は Set・Map の中身を比べます
- **`z.map()`**：set と同じく 1 つの欄で、record の entries の見た目で組を書きます。キーは string・number だけを受け、それ以外は扱えない注記を出します
- **キーを列挙できる record**（キーの schema に `_zod.values` があるもの。enum・literal とその union）：zod はすべてのキーを必須として検証するので、そのキーを固定の欄として object と同じように並べます。欄の名前はキー（選択肢に label があればその label）で、`uiType: "entries"` でも同じです。`z.partialRecord` は `_zod.values` が空なので、今までどおりの見た目です
- **キーの検査のエラー**（`invalid_key`）は、キーの側（entries ならそのキーの欄、既定の見た目なら record の欄）に出します
- **tuple の rest**、**array の `uiType` と要素の組み合わせが合わないもの**（要素が object の配列に `multipleEnum` など）は、型で縛りにくいので、その欄の場所に「この組み合わせは非対応」と出し、`console.error` を出します

## そのほかの型

- **`z.file()`**：File を値に持つファイルの入力欄（Mantine の `FileInput`）。外に置いたファイルを指す文字列は `zf.externalFile` で、別のものです
- **`z.templateLiteral()`**：文字列の入力欄。形は zod の検証で確かめます
- **欄を出さず値を保つ型**：`z.any()`・`z.unknown()`・zf の型でない `z.custom()`・`z.symbol()`・`z.function()`・`z.never()`。値はそのまま保って送り、エラーがあればエラーだけを出します。`hidden: false` でも中身は出しません
- **`z.promise()` と非同期の検査**（`.refine(async …)`）：同期の `safeParse` は例外を投げるので、`FormRuntime` の検証と parse でこれを握り、`console.error` を出して、送信が止まった理由として「非同期の検証を扱えない」ことを出します。`z.promise()` の欄には扱えない注記を出します（形だけを確かめるなら `z.custom` を使う）
- **どの部品にも当たらない型**：その欄の場所に扱えない注記（`UnsupportedNotice`）を出し、`console.error` に型の名前を出します
- **`zf.computed()`**：値を持たない表示専用の欄なので、初めから optional を含みます

## 再帰（`z.lazy`）の深さ

optional の付かない再帰は描画が終わらないので、lazy の部品が入れ子の数を数え、上限（既定 10）を超えたら止めて扱えない注記を出します。その先の値は消さずに送ります。上限は lazy の meta の `maxDepth`（`zf.common.registry`）で変えられます。

- 数えるのは、値が無くても中を描く所（object・intersection・tuple・キーの決まった record・pipe など）だけで続いている lazy の連なりです
- 値が無ければ中を描かない部品（optional・nullable な object・intersection の 0..1 の枠、array、record の entries・Map、union）を通ったら、数を 0 に戻します（`ResetLazyDepth`。上限は引き継ぐ）。そこから先は値の深さで止まるためです。optional の包み自体では戻しません（中が tuple・キーの決まった record なら、値が無くても中を描くため）
- 同じ schema かどうかは見ません。zod の内部の動きに頼ることになるためです

## `zf.*.registry` の型の約束

zf の typeName が zod の型の名前と同じなら、その zod の型を必ず受け付け、同じ部品で扱います。型の約束を広げてほかの型も受け付けてよく（`zf.date` は `z.coerce.date()`・`z.number()`・`z.iso.*` も受ける）、zod の型に対応しない独自の名前は zod の型の名前と重ねません。`zf.externalKey`・`zf.externalFile` は、`zf.string` と同じく書式付きの文字列（`z.email()` など）も受けます。
