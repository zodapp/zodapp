# 実験 1：同じ path の受け渡し

- ステータス: 実験済み（判定：案F（props にまとめる版）を採用。未実装。ブランチの今のコードは案E）
- 対象ブランチ: `claude/project-thread-6bm7mu`（土台は `claude/union-arm-errors-v2`）
- 対象パッケージ: `@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`@zodapp/zod-form-mantine-lite`

---

## 1. 背景

TanStack Form は path ごとに欄を持ち、zod は木をたどって検証する。`.optional()`・`.nullable()`・
`.default()`・`.refine()` は、同じ path の外側の schema が持つ。部品が path で欄を切り出すと、
その外側の情報が見えなくなる。

これまでは次の 2 つで補っていた。

- 部品の props `optional`・`nullable` の手渡し（子の Switch で `optional={undefined}` を書いて消して回る）
- `useDynamicSchema` が、登録する schema を props の `optional`・`nullable` で包み直す

## 2. 先に確かめたこと（テスト：`zod-form-mantine/src/components/samePath.spec.tsx`、`externalKey.spec.tsx`）

土台のブランチで、次を確かめた（コミット `402fe92`。この時点で 4 件が落ちる）。

| 場合                                                                 | 土台での動き                                       |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| dynamic の欄の外側の `.refine()`                                     | **効かない**（エラーが捨てられ、送信できてしまう） |
| optional の中の `.refine()`                                          | **効かない**                                       |
| externalKey の欄の外側の `.refine()`                                 | **効かない**                                       |
| dynamic の欄の外側の `.default()`・`.optional()`・`.nullable()`      | 効く（props で包み直しているため）                 |
| `zf.dynamic()`（土台が `z.never`）を兄弟に持つ object の `.refine()` | **効かない**（下の 6. を参照）                     |

原因は推測どおりだった。`FormRuntime.validate` は、登録された path の下の静的な schema の issue を捨て、
登録された schema の issue を使う。登録された schema は resolve が返した schema だけなので、
外側の `.refine()` の issue はどこにも残らない。

コードを読んで見つけた漏れがもう 1 つある。tuple の部品が、自分の `optional`・`nullable` を
要素の Switch にそのまま渡していたため、optional な tuple の要素が必須にならなかった。

## 3. 試した案

どの案も、「同じ path の schema の連なり」（外から内の順）を作り、path が変わったら切る。
連なりは Switch が描くたびに自分の schema を積んで作る。path ごとに積み直すので、
object・array・record・tuple の子では自然に切れ、消して回る必要がない。
union の腕は同じ path だが、空は腕を選ぶ欄が受け持つので、明示して切る（今の `optional={undefined}` と同じ意味）。

連なりから次を求める。

- **空の扱い**：optional・default・prefault の中なら optional、nullable の中なら nullable。空にするときに書く値も
- **包み直し**（`rewrapWithChain`）：resolve が返した schema を、内から外へ、optional・nullable・default・prefault は同じ包みで、
  それ以外（dynamic の土台、lazy、preprocess など）は包まずに、それぞれに付いた検査（`.refine()`・`.min()` など）を `.check()` で付け直す

### 案A：連なりを context で渡す（コミット `8284eaa`）

- `SamePathProvider`（Switch が自分を積む）、`SamePathReset`（union の腕）、`useSamePathChain(fieldPath)`
- `useDynamicSchema` は連なりで包み直して登録する（optional・nullable の指定はなくした）
- 互換のため、Switch が連なりから optional・nullable を求めて props に入れる（呼ぶ側の指定は使わない）
- 結果：単体テストすべて、form-demo の e2e 106 件すべて通過。2. の dynamic・externalKey の `.refine()` が効くようになった
- 直した既存テスト：union の単体テスト 2 件が `Switch` に `optional={true}` を直に渡していた。schema を `.optional()` にした

### 案C：props の `optional`・`nullable` を廃止する（コミット `36522c7`。案A の上）

- `ZodFormProps` から `optional`・`nullable` を消し、部品は `useEmptiness(fieldPath)`（`optional`・`nullable`・`emptyValue`）で求める
- 子の Switch の `optional={undefined}`・`nullable={undefined}` をすべて消した
- tuple の漏れ（上の 2.）も、これで無くなった（テストを足した）
- 結果：単体テストすべて、e2e 106 件すべて通過。差分は 43 ファイル、+136 / −175 行（機械的な置き換えが大半）
- 破壊的変更：`ZodFormProps` の `optional`・`nullable` を使う外の部品・呼び出しは書き換えが要る

### 案B：連なりを props で渡す（スパイク。コミット `b088d11` で試し、`07543b9` で戻した）

- `ZodFormProps` に `samePath`（{ path, chain }）を足し、Switch が付けて部品に渡す。`useEmptiness(fieldPath, samePath)`・`useDynamicSchema(meta, fieldPath, samePath)`
- 結果：単体テストすべて、e2e 106 件すべて通過。動きは案A・C と同じ
- ただし次の点で案A・C に劣るので、戻した
  - 同じ path に Switch を描く部品は、すべて `{...props}` で `samePath` を運ばなければならない。運び忘れると黙って包みが消える
    （今の `optional` の手渡しと同じ形の漏れ方）。context なら運ぶ必要がない
  - hook が props を引数に取るので、呼ぶ側すべてが `samePath` を取り出して渡す（案C より差分が増える：44 ファイル）
  - path の違う子へ `{...props}` で広げても、path が違えば使わないので漏れはしない（この点は context と同じ）

### 案D：Switch で包みを剥がし、WeakMap にキャッシュする（コミット `61c308c`。案C の上）

スレッドでの提案を受けて試した。同じ path の包みは、dynamic を越えない限り、Switch が受け取った schema の中に
静的にすべて入っている。

- Switch が schema の外側の optional・nullable・default・prefault・lazy を剥がし（`peelSamePath`）、中身の部品を直接描く。
  optional などの部品は経由しない
- 剥がした包みと中身は、まとめて同じ path の連なりに積む。実行時に同じ path をまたぐのは dynamic・externalKey・preprocess
  だけで、その先の Switch が連なりを続ける
- 結果は schema ごとに WeakMap にキャッシュする（schema は不変）
- 包みに meta が付いていれば、そこで止める（hidden など、meta で部品を選ぶとき）。`.optional()`・`.nullable()` の包みには
  中身の meta は伝わらない（`getMeta(s.optional())` は undefined）ので、ふつうは止まらない
- nullable・default の中なら、初期値が無いとき null を渡す（今の NullableComponent・DefaultComponent と同じ）。
  defaultValue の付け替えが、部品から Switch の一か所に移る
- 結果：単体テストすべて、e2e 106 件すべて通過。componentLibrary に optional・nullable・default が無くても描けることをテストした
- 案A の連なりの重複を避ける処理（`SamePathProvider` が同じ schema を二度積まない）は、optional などの部品を直に描くとき
  （テスト）のためだけに残る
- 注意：optional・nullable・default・lazy の部品を componentLibrary で差し替えても、Switch が剥がすので使われなくなる（破壊的変更）

### value・parent の受け渡し

実験 1 では渡さなかった。同じ path の部品は、どれも path で store を読めば同じ value・parent が得られるため。

性能について、最初は「props で上から渡すと、打鍵のたびに祖先が描き直される」と考えたが、誤りだった。
今も object・array・array_table は `wrapComponent` → `useZodField`（TanStack の `useField`）で `state.value` を購読しているので、
子の欄を打つたびに根からその欄までの祖先はすでに描き直されている（兄弟は props が変わらず memo で止まる）。
value を props で渡しても描き直しの回数はほぼ変わらない。差が出るのは、object・array が値ではなく構造だけを購読するように作り直したとき。

### 案E：今の props の分担のまま、dynamic が自分の検査を付け直す（コミット `28a41a5`。案A〜D を土台に戻した上）

スレッドでの議論から試した。筋の通る形は「props を保つ（E）」か「連なりに統一する（A＋D）」のどちらかで、
その中間（Switch が連なりから props に入れる）は、optional・nullable の部品の責務を Switch に移すだけで得るものが無い。

- 決まり：自分の schema に付いているものは自分で扱い、包みの情報は包みの部品が props で渡す（今の分担）
- `useDynamicSchema` に欄の schema（`props.schema`）を渡し、その `def.checks` を決まった schema に `.check()` で付け直してから、
  今どおり optional・nullable で包む。dynamic・externalKey・複数選択の externalKey の 3 か所で schema を渡す
- tuple が要素に optional・nullable を渡していた漏れを、ほかの部品と同じく `optional={undefined}` にして直す
- 差分（テストを除く）：5 ファイル、+42 / −8 行。破壊的変更なし（`useDynamicSchema` の指定に任意の `schema` が増えるだけ）
- 結果：単体テストすべて、e2e 106 件すべて通過。dynamic・externalKey の `.refine()`、optional の中の `.refine()`、
  `.default()`・`.optional()`・`.nullable()`、tuple の要素が必須になることを確かめた
- 失うもの（`it.fails` で記録）
  - 包みの側に付いた検査（`dyn.optional().refine(...)`）。dynamic からは包みの schema が見えない
  - 入れ子の dynamic の外側に付いた検査。内側の DynamicComponent は内側の schema しか受け取らず、検証には一番深い登録を使う

### 案F：包みの情報を props にまとめて運ぶ（設計。未実装）

案E の議論の続きで決めた形。案E の「自分の schema に付いているものは自分で扱い、包みの情報は包みの部品が props で渡す」
という分担を保ったまま、包みの側に付いた検査も同じ props で運び、案E で失う 2 つを扱う。同じ path の受け渡しのための
新しい context は作らない（案A・D の連なりは使わない）。

#### props の役割

| props                                      | 役割                                                            | 書く部品                                                                                                         | 読む部品                                                 |
| ------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `fieldPath`・`schema`・`readOnly`・`label` | 今のまま                                                        |                                                                                                                  |                                                          |
| `outer`（名前は仮）                        | 同じ path の外側の包みの情報。下の表                            | 包みの部品（足して下へ渡す）                                                                                     | 葉の部品、dynamic・externalKey                           |
| `defaultValue`                             | default・optional・nullable が下の層に渡す既定の値              | default（`.default(x)` の x）、nullable（無ければ null）、object・array・tuple・record（子の分を取り出して渡す） | 新しく値を作るところ（配列の追加、union の腕の選択など） |
| `value`（新設）                            | form を使わない部品が表示する値。今 defaultValue で代用している | ReactiveAutoForm・AutoTable とその下の object など                                                               | form を使わない部品                                      |

`outer` の中身：

- `optional`・`nullable`：undefined・null を受け付けるか。葉の部品は、取り消し（×・選び直して外す）を出すか、必須の印、
  空にしたときに書く値（optional なら undefined、nullable だけなら null）をここから決める
- `wraps`：外側の包みの並び（外から内の順）。それぞれ「包みの種類（optional・nullable・default など）」と「その包みに付いた検査」。
  検査がどの包みの内か外かで、undefined・null のときに走るかが変わるので、まとめて 1 つの配列にせず順を保つ

#### 書く側・読む側

- optional・nullable・default・prefault の部品：受け取った `outer` に自分の分（種類と検査）を足し、内の Switch に `{...props}` で渡す
- PreprocessSwitch：preprocess の pipe 自体に付いた検査を `outer` に足す（値は今どおりそろえて書き戻す）
- lazy：そのまま渡す
- dynamic・externalKey：`useDynamicSchema` が、決まった schema に、自分の schema（`props.schema`）の検査を付け直し、
  `outer.wraps` を内から外へ包み直して登録する。内の Switch へは、自分の検査を `outer` に足して渡す（入れ子の dynamic のため）
- 葉の部品：`outer.optional`・`outer.nullable` を読む（今の `optional`・`nullable` の props の置き換え）
- path が変わるところ（object・array・record・tuple）と union の腕：`outer` を消して渡す（今の `optional={undefined}` の置き換え。消すのが 1 つで済む）

#### 案E・案A＋D との比べ

|                                             | 案E                                | 案F                                                      | 案A＋D          |
| ------------------------------------------- | ---------------------------------- | -------------------------------------------------------- | --------------- |
| dynamic 自身の検査                          | 効く                               | 効く                                                     | 効く            |
| 包みの側の検査・入れ子の dynamic の外の検査 | 効かない                           | 効く                                                     | 効く            |
| 運ぶ仕組み                                  | props                              | props（一つ）                                            | context（一つ） |
| 漏れの防ぎ方                                | 子で消す（`optional`・`nullable`） | 子で消す（`outer` 一つ）                                 | path で自動     |
| 破壊的変更                                  | なし                               | あり（`optional`・`nullable` → `outer`、`value` の新設） | あり            |

## 4. 判定

**案F を採用**（未実装）。ブランチの今のコードは案E で、案F はその上に積む。

- 案F を採る理由
  - 案E の責務の分担（包みの部品が自分の分を足して下へ渡す）のまま、案A＋D と同じ範囲（包みの側の検査、入れ子の dynamic）を扱える
  - 運ぶ仕組みは props の一つだけ。context の連なりと props が二つの経路に分かれる形（連なりを必要なときだけ使う案）は、
    切る場所で両方を切る必要があり、食い違いやすいので採らない
  - 消して回るのが `outer` 一つになる
  - value を props で渡しても性能は落ちない（上の「value・parent の受け渡し」）。defaultValue を value の代わりに使う今の形をやめられる
- 案A＋D を採らない理由：扱える範囲は同じだが、context と Switch での剥がしが入り、optional などの部品の責務が Switch に移る
- 注意
  1. `def.checks` の中身（検査の object）をほかの schema に `.check()` で移すのは、zod の文書にある使い方ではない。
     zod の更新で `samePath.spec.tsx`（zod-form-mantine）のテストが落ちないかを見る
  2. 土台の型そのもの（`zf.string()` の文字列であること）は付け直さない。検査だけを付け直す。`.min()` のような型ごとの検査は、
     resolve が返した schema の値にもそのままかかる（例：enum の値に文字数の検査）。型の違う schema を返す dynamic では注意
  3. dynamic の欄に直接付いた検査は、zod 4 では包みを作らず、同じ型の複製の `def.checks` に入る。zf の meta は
     zod-propagating-registry（zod-form 独自のしくみ。zod の仕様ではない）で複製に引き継がれるので、DynamicComponent が受け取る
     schema にその検査が入っている。案E・案F はこれに頼る
  4. 今の DefaultComponent は `.default(x)` の x ではなく `defaultValue ?? null` を下に渡している。defaultValue の役割に合わせて x を渡すように直す
  5. record の `field.value ?? defaultValue` と union の腕の初期値が、defaultValue の手渡しにどこまで頼っているかを、実装の前に確かめる

## 5. 案F でも解決できないこと

- **path の違う検査（object の `.refine()` など）**：`zf.dynamic()` は土台が `z.never` なので、静的な検証で必ず落ち、
  zod は object の検査を走らせない。登録された path の issue は捨てるので z.never の issue も見えないが、object の `.refine()` も黙って効かない
  （`it.fails` で記録した）。直すなら、静的な検証で dynamic の土台を「何でも通す」schema に差し替えるか、登録された schema を
  静的な木に差し込んで一度に検証する（別の実験）
- **transform・pipe の in 側**：今の PipeComponent は `def.out` を描くので、`.transform()` の欄は描けず（out が ZodTransform）、
  dynamic を pipe の in 側に置く書き方も描けない。出力側で検証する `.pipe(Y)` を付け直すのは、PipeComponent が in を描くように直してから
  （`outer.wraps` に「出力側の schema」を足せば運べる）
- **漏れの構造**：props で運ぶので、path が変わるところで `outer` を消すのは手作業のまま。消し忘れると漏れる（tuple で起きた形）。
  案A＋D の「path で自動に切れる」性質は持たない。部品を足すときの決まりとして明記する
- **union の腕のエラーの配り直し**（`invalid_union`・`onDynamic`）：同じ path の受け渡しとは別の問題（実験 2）

## 6. 見たところ（案A〜D のとき）

- **pipe（transform）**：pipe の部品は `def.out` を描く（`in` を描かない）ので、`in` に dynamic を置く使い方は今も描けない。
  包み直しは pipe を素通しにした（検証の issue には効かないため）
- **preprocess**（案A〜D）：連なりには入るが、包み直しは素通し。値は描く前にそろえているので、検証に preprocess を付け直す必要はない
- **同じ path の境目**：path の文字列が同じかで切る。union の腕だけ明示して切る。lazy・pipe・preprocess・dynamic・externalKey は同じ path として運ぶ
- **object の `.refine()`（path の違う検査）は直らない**。`zf.dynamic()` は土台が `z.never` なので、静的な検証で必ず落ち、
  zod は object の検査を走らせない。登録された path の issue は捨てるので、z.never の issue も見えないが、object の `.refine()` も黙って効かない。
  同じ path の受け渡しでは直せない（`it.fails` で今の動きを記録した）。直すなら、静的な検証で dynamic の土台を
  「何でも通す」schema に差し替えるか、登録された schema を静的な木に差し込んで一度に検証する（別の実験）
- **zod 4 の ZodEffects に当たるもの**（zod 4 には ZodEffects が無い）
  - refine・superRefine・check・overwrite：包みを作らず、同じ型の複製の `def.checks` に入る。dynamic 自身に付いたものは
    `props.schema` から付け直せる（案E）。包みに付いたものは、包みの部品が下へ渡す必要がある
  - preprocess（`pipe(transform, X)`）：PreprocessSwitch が保存値をそろえて書き戻し、同じ path で X を `{...props}` で描く。
    登録する schema はそろえたあとの値を検証するので、preprocess を付け直す必要はない。preprocess の pipe 自体に付けた検査は、
    包みの検査と同じ扱い（props で運ぶなら、PreprocessSwitch が足す）
  - transform・pipe（`pipe(X, …)`）：今の PipeComponent は `def.out` を描くので、`.transform()` の欄は描けず（out が ZodTransform）、
    dynamic を in に置く書き方も描けない。出力側で検証する `.pipe(Y)` を付け直すのは、PipeComponent が in を描くように直してからの課題
