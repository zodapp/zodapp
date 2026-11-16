# スモーク e2e の残りを片付け、form-demo の e2e をそろえる

## 全体像

このファイル 1 つで、PR #21 に残っている作業をすべて書く。承認されたら、「進め方」の順に、確認を挟まずに実装する。

| 状態 | 内容 |
|---|---|
| 済み | A：unlisted の届け直し、B：ミリ秒の時刻欄、C：unlisted の README、D：日時の書き方を時刻にそろえる、precision 1・2 のミリ秒の欄の指摘 |
| 実装中 | モックの externalKey を topic の set だけで届ける形に、externalKey の失敗を dynamic の失敗につなぐ、e2e の土台、`e2e-dynamic`・`e2e-time-input`・`e2e-precision` |
| この計画で足す | ライブラリの直し 7 つ（「ライブラリの直し」の節）と、e2e のページ 4 つ（`e2e-external-key`・`e2e-open-rewrite`・`e2e-union`・`e2e-table`） |
| 済み（あとから決めた） | e2e のケースを、重なるデモページに移す。e2e 用のページは `e2e-open-rewrite` だけを残す（「e2e のケースの置き場所」の節） |

e2e のケースと、それを置くページ：

| ケース | 置くページ（formId） | spec |
|---|---|---|
| 1. dynamic の読み込み・失敗・再試行・連鎖 | `dynamicAdvanced`（zf.dynamic（読み込み・購読・連動）） | `dynamic-advanced.spec.ts` |
| 2. 時刻の打ち込み | `time`（zf.time） | `time.spec.ts` |
| 3. precision・unit で書かれる形 | 日時は `date`（zf.date）、時刻は `time`（zf.time） | `date.spec.ts`・`time.spec.ts` |
| 4. 選択肢の届き方 | `externalKeyFilter`（zf.externalKey（絞り込み））。上限が変わる数量だけ `dynamicAdvanced` の在庫の欄 | `external-key-filter.spec.ts`・`dynamic-advanced.spec.ts` |
| 5. 開いただけで書き換えるもの | `e2e-open-rewrite`（e2e 用のページ。メニューに出ない） | `e2e-open-rewrite.spec.ts` |
| 6. union の腕の切り替え | `discriminatedUnion`（z.discriminatedUnion）の窓口の欄 | `discriminated-union.spec.ts` |
| 7. 表 | `tableView`（表（AutoTable）） | `table-view.spec.ts` |

この計画のあとに残るものは無い（PR #21 のマージだけ）。

## 目的

e2e が失敗したとき、人が同じ URL を開き、同じ手順を手で試して確かめられるようにする。
そのために、e2e で確かめたいことをデモページに置き、それに対して e2e を書く。

- テストの手順は、ページの説明に書く手順と同じにする（`playwright.config.ts` の「手順はページを開いて試す手順と同じにする」と同じ方針）

## e2e のケースの置き場所

- e2e で確かめたいことは、重なるデモページ（メニューに出るデモ）に置く。欄が足りなければ、そのデモに欄を足す
- 遅延の分け方の選択・止めておいた取得の「届ける」「失敗させる」・選択肢を届け直すボタンなど、フォームの外から動きを起こす操作は、デモページの「動きを試す」の枠（`src/shared/demo/TryBehavior.tsx`）にまとめ、フォームの欄と見分けられるようにする。説明は人が読んで分かる日本語で書く
- 人が開いたときの既定は、デモの今の見やすいふるまい（ms の遅延、3 秒ごとに変わる在庫など）のままにする。テストは「動きを試す」で分け方を選んでから進める
- e2e 用のページ（メニューに出ない）は、デモに向かないものだけに使う。今は `e2e-open-rewrite`（わざと選択肢に無い初期値や type の無い古い形の初期値を持つ）だけ

## 前提

- A・B・D の修正と同じブランチ（PR #21）で続けて実装する
- 選択肢を届け直すボタン（A）は、公開のデモページ「zf.externalKey」に置いたままにする。この計画では動かさない

## 置き場所と登録（e2e 用のページ）

デモに向かないケースだけを置く e2e 用のページの置き場所。部品・レイアウト・デザインは、今のデモページと同じにする。違うのは、メニュー・トップ・一覧に出さないことだけ。

- `apps/form-demo/src/pages/form/schemas/e2e/` に置き、別の登録簿 `e2eSchemas`（`schemas/e2e/index.ts`）を作る。モジュールの形（`formId`・`title`・`description`・`schema`・`defaultValues`・`Component`）は今のデモと同じ
- formId は `e2e-` で始める（例：`e2e-open-rewrite`）
- 詳細ページ（`/form/detail?formId=…`）は `formSchemas` と `e2eSchemas` の両方から引く。サイドバー（`Layout.tsx`）・一覧（`list.tsx`）・トップは `formSchemas` だけを使うので、e2e のページは出ない
- 「コード」タブも今のデモと同じに出す（`?raw` の import を `e2eCodes` に置く）
- GitHub Pages のビルドにも含める（URL を知っていれば開ける）

## 見るための共通の部品（全ページ）

メニューに出るページと出ないページで分けず、form-demo のすべてのページで同じ部品を使う。今メニューにあるページの e2e も、同じ仕組みで値やログを読めるようにする。

部品（`E2eHarness`）は、今 AutoForm の `showPreview` で出しているプレビューを広げる形で作り、次を出す。人が読んで分かる表示にする。

- 今の値（今のプレビューと同じ JSON の書式）
- 欄ごとのエラー（`form.getAllErrors()` の fields と form）
- isDirty
- 送信した値と、送信の回数（送信が止まったときは回数が増えない）
- ログ（開閉できる。下の「ログ」を参照）
- 必要なページだけ：「外から書き込む」「利用者の編集として書き込む」（`useRunAsUserEdit`）のボタン

- 詳細ページ（`detail.tsx`）の汎用の描画では、今の `showPreview` の代わりにこの部品を使う
- 自前の `Component` を持つページも、同じ部品を置く
- ハーネスは AutoForm の `actionComponents` として描き、form の API を受け取る

### 直接読むルート

- 部品は、表示と同じ中身を `window.__formDemo` に置く（今の値・欄ごとのエラー・isDirty・送信した値と回数・ログ）。画面の表示もこの同じ中身から描くので、人が見る表示と e2e が読む値はずれない
- e2e は値・エラー・回数・ログを `page.evaluate` で読み、変わるのを待つときは `expect.poll` を使う。プレビューの文字を読んで JSON として解析することはしない
- 利用者が見るもの（欄の表示、選択肢、エラーの文言、読み込み中・再試行の表示）は、これまでどおり画面で確かめる。直接読むルートだけで確かめると、画面が壊れていても通ってしまうため

### ログ

次の出来事を、時刻付きで記録する。

- 値の変更：前の値と後の値、変わった欄
- dynamic の取得：モックの resolver の load・subscribe が呼ばれたこと（どの欄・どの key か）と、その結果（届いた・失敗した）。resolver は form-demo の中にあるので、form-demo の中で数える
- dynamic の状態：DOM の `data-dynamic-status` の移り変わり
- 送信：試みたこと、通ったか止まったか

e2e は、これを読んで「取り直しは帳票の項目の 1 回だけ」「ほかの欄は取り直していない」のように、画面では見えにくいことを確かめる。

ライブラリ（zod-form・zod-form-react・zod-form-mantine）は変えない。値が消えた理由（prune か unlisted の clear か）はこの方法では分からないが、まずは取らない。理由まで要るケースが出たら、そのときにライブラリに出来事を知らせる口を足すかを別に決める。

## 遅延とタイミング

遅延は「本物に近い ms」では決めない。今のデモの 400 ms や 1 秒は、人が読み込み中を見られるための数字で、テストの根拠にはならない。代わりに、何と競るかで次のように分ける。

| 分け方 | 作り方 | 確かめること |
|---|---|---|
| すぐ届く | externalKey は topic に値がある状態で購読する（その場で届く）。load は解決済みの Promise を返す | キャッシュに当たったときのように、描画の前に値が決まる場合 |
| 1 フレーム後・2 フレーム後 | `requestAnimationFrame` を重ねてから `set` する（load の欄は、デモの resolver で同じように返す） | 描画や effect と競る場合（以前の 2 フレーム後のバグはここ） |
| 届けるまで止めておく | externalKey は値の無い topic を作り、ボタン（「届ける」）で `set` する。load はボタン（「届ける」「失敗させる」）を押すまで返さない | 読み込み中の操作（送信する・別の欄を変える・種類を切り替える）。時間ではなくこれで作る |

- 仕組みは `src/shared/demo/fetchControl.tsx`（`createFetchControl`・`FetchControlPanel`・`controlledLoad`・`createControlledExternalKeyResolvers`）。デモページの「動きを試す」の枠に置く
- ページ上で分け方を選べるようにし、選んだ分け方を画面に出す。止めておく分け方では、待っている取得の一覧と、その「届ける」「失敗させる」ボタンを出す
- テストごとに、どの分け方を使うかを決めて書く。結果がタイミングに依らないはずのもの（連鎖の消え方、最後に選んだ種類だけが残ることなど）は、すべての分け方で同じ結果になることを確かめる
- 人が開いたときの既定は、今の見やすい数字（ms の遅延）のままにする。テストはこの数字に頼らない
- 周期で起きる動きは使わず、ボタンで 1 回ずつ進める
- テストは時間を待たず、画面の状態と直接読むルート（読み込み中が消えた、選択肢が出た、ログに取得が増えた）を待つ

## モックの externalKey を、topic の set だけで届ける形にする（zod-form）

今のモックは、購読を受けると `delayMs`（既定 300 ms）だけ待ってから `topic.get()` を届ける。topic は作ったときから値を持つので、「最初の選択肢を届けずに止めておく」「購読したその場で届ける」が作れない。届く時機は、すべて topic の `set` を呼ぶ側が決める形にそろえる。

- `createMockTopic` は「まだ値が無い」状態で作れるようにする。値が無いあいだ、resolver は何も届けない（欄は読み込み中のまま）。最初の `set` で届ける
- topic に値があるときは、待たずに購読したその場で届ける
- モックから `delayMs` をなくす（resolver の引数と config の両方）。遅延はモックの仕組みとして持たない
- 人が見るデモで読み込み中を見せたいページは、デモの側で resolver を包んで遅らせる（デモの中の状態として持つ）。今の公開のデモで、都道府県を変えるたびに市区町村が読み込み中になる表示は、これで残す
- 「動きを試す」の枠を持つデモページでは、遅延の分け方（すぐ届く・フレーム後・止めておく）を、ページが `set` を呼ぶ時機で作る
- zod-form のモックの単体テストと README を合わせて直す

## externalKey の取得の失敗を、dynamic の失敗につなぐ（zod-form・zod-form-react・zod-form-dynamodb）

externalKey の resolver の `subscribe` は選択肢を受け取る関数しか持たず、失敗を知らせる道が無い。本物の resolver で通信に失敗すると、欄は読み込み中のまま止まるか、空の選択肢に見える。dynamic にはすでに失敗の道（error と「再試行」）があるので、そこへつなぐ。

- resolver の形を `subscribe(callback, onError?)` にする。`onError` は省略できるので、今の resolver はそのまま動く
- `onError` を呼ぶと、欄は dynamic の error になり「再試行」が出る。送信は止まる。値は prune も unlisted の clear もしない
- 同じ購読のまま、あとで選択肢が届けば、再試行を押さなくても戻る（dynamic の今のふるまい）。再試行を押すと、購読をやめて最初からやり直す
- モックの topic に `fail(error)` を足す。購読中の欄に失敗を届け、topic は失敗の状態を覚える。失敗の状態のあいだに購読した欄にも、その場で失敗を届ける。`set` で失敗の状態は消え、選択肢を届ける
- DynamoDB の resolver（`zod-form-dynamodb`）は、store が `error` になったら `onError` を呼ぶ（今は無視して読み込み中のまま）
- 単体テスト：モック（fail・失敗の状態での購読・set で戻る）、zod-form-react のつなぎ、zod-form-mantine の externalKey の欄（error と再試行）、DynamoDB の resolver
- README の externalKey の resolver の節に `onError` を書く
- この変更は、e2e のページとは別のコミットにし、同じ PR（#21）に載せる

e2e：`dynamicAdvanced` の都道府県 → 市区町村 → 町名で、topic を失敗させると「再試行」が出て送信が止まり、失敗をやめて再試行すると戻ることを確かめる。

## e2e のケース

### 1. dynamic の読み込み・失敗・再試行・連鎖（`dynamicAdvanced`）

もとは e2e 用のページ `e2e-dynamic`。デモページ「zf.dynamic（読み込み・購読・連動）」に移した（spec は `dynamic-advanced.spec.ts`）。

ページ：帳票の種類（load で項目を取る。領収書だけが「再発行」の真偽の部品を使う）、変わり続ける在庫で上限が変わる数量、都道府県 → 市区町村 → 町名の連鎖。「動きを試す」の枠に、遅延の分け方の選択（止めておく分け方では「届ける」「失敗させる」のボタン）・取得を失敗させるスイッチ・在庫を 3 秒ごとに変えるスイッチと在庫を 3・10 にするボタン。見るための部品に、外からの書き込みと利用者の編集としての書き込みのボタン

e2e：
- 帳票の種類を変えると、項目が読み込み中になり、新しい項目が出る。取り直すのは帳票の項目だけ（ログの load は帳票の項目の 1 回だけで、ほかの欄は読み込み中にならない）
- 止めておく分け方で取り直し中に送信すると、送信は止まる（送信の回数が増えない。ログに「止まった」が残る）
- 失敗させて種類を変えると「再試行」が出る。失敗をやめて再試行すると戻る
- 止めておく分け方で種類を行き来し、届ける順を入れ替えても、最後に選んだ種類の項目だけが残る
- その種類で初めて使う部品が出ても、ほかの dynamic の欄は取り直さない（ログに、ほかの欄の load・subscribe が増えない。以前の不具合の再発を防ぐ）
- 都道府県を変えると、市区町村・町名が順に消える。都道府県を消すと、市区町村は「先に都道府県を選んでください」で無効になり、必須エラーは出ない
- すぐ届く・1 フレーム後・2 フレーム後のそれぞれで、連鎖の消え方と最後の選択が残ることが同じになる

### 2. 時刻の打ち込み（`time`）

もとは e2e 用のページ `e2e-time-input`。デモページ「zf.time」に移した（spec は `time.spec.ts`）。

ページ：デモの `z.iso.time({ precision: 3 })` の欄に加え、`z.iso.time({ precision: 1 })`・`z.number()` + `millisecondsOfDay` の欄を足した。初期値があるので、e2e は欄を空にしてから打つ

e2e（キーを一つずつ押す。`pressSequentially`）：
- 空の欄に `10:45:30.123` を打って欄を出ると、表示も値も `10:45:30.123`
- 途中の桁を Backspace で消して打ち直すと、打ったとおりになる
- Enter で値に入る
- 読めない値（`9:30`）で欄を出ると、形のエラーが出て、送信が止まる。前の値が黙って残らない
- 範囲外（`12:60:00`）で欄を出ると、必須ではなく形のエラーが出る

### 3. precision・unit で書かれる形と、開いただけで書き換えないこと（`date`・`time`）

もとは e2e 用のページ `e2e-precision`。日時はデモページ「zf.date」、時刻は「zf.time」に移した（spec は `date.spec.ts`・`time.spec.ts`）。

ページ：
- zf.date：「6. precision・unit で書かれる形」の節に、日時（Z あり・local）の precision なし × unit（minute・second・millisecond）と、precision -1・0・3 の欄を足した。初期値は固定の日時（開いた時刻にしない）で、unit より細かい部分まで持つ
- zf.time：デモの precision -1・0・3 と unit minute の欄に、unit second・unit millisecond の欄を足した（初期値は 09:30:15.250）

e2e：
- 開いただけでは値が変わらない（isDirty が false、値が初期値のまま）。zf.date と zf.time のそれぞれで確かめる
- 各欄を編集すると、決めた形で書かれる（precision なしの日時は unit で決まる。minute でも秒まで `:00` を書く）
- unit が保存値より粗い欄は、編集すると細かい部分が 0 になる

## ライブラリの直し

スモーク e2e で見つかって、まだ直していないもの。項目ごとに別のコミットにし、単体テストと README を合わせて直す。

### L1. clear・prune で値を消しても、その欄を「触った」「変えた」にしない

今は、unlisted の clear は `field.onChange`、dynamic の prune は `form.setFieldValue` で書くので、TanStack Form がその欄を touched・dirty にする。そのため、

- 消えた欄に、まだ触っていないのにすぐ「必ず入力してください」が出る
- 開いただけで clear が値を消すと、isDirty が true になる

直し方：clear と prune は、`form.setFieldValue(path, value, { dontUpdateMeta: true })` で書く（preprocess の union を開いたときにそろえる処理と同じ）。clear は今と同じく `runAsUserEdit` で包み、下の dynamic への連鎖はそのまま残す。

決まること：
- 消えた欄の必須のエラーは、ほかの必須の欄と同じく、触るか送信するまで出ない
- 開いたときの書き換え（clear・preprocess の union）では isDirty は false のまま。書き換えは仕様として残す（README に書く）
- 利用者が上の欄を変えて下の欄が消えたときは、上の欄の編集で isDirty が true になる

### L2. 送信が止まった理由を画面に出す（zod-form-widget の AutoForm）

今は送信が止まっても console に出るだけ。止まったとき、`runtime.validate` の結果から理由を数えて、ボタンの行の近くに出す。

- 読み込み中の欄がある：「読み込み中の欄があるため、送信できませんでした」
- 取得できなかった欄がある：「取得できなかった欄があるため、送信できませんでした」
- 入力の誤りがある：「入力に誤りがあるため、送信できませんでした」
- 当てはまるものをすべて出す。次に送信を押すまで出したままにし、送信が通れば消す
- `data-testid="form-submit-blocked"` を付ける

### L3. モックの無い topic を失敗にする

今は空の選択肢が届くだけで、名前の間違いに気づけない。無い topic を購読したら、`onError` で `Error('topic "…" がありません')` を届ける。欄には error と「再試行」が出る。

### L4. `allowUnlisted` と `unlisted` を同時に書けないようにする

`allowUnlisted: true` のときは選択肢に無い値も正しい値なので、`unlisted` は効かない。名前は変えず、config の型で両方を同時に書けないようにし（`allowUnlisted: true` なら `unlisted?: never`）、README に違いを書く。

### L5. `useRunAsUserEdit` の効く範囲を README に書く

API は残す。unlisted の作り直しのあと、出どころ（利用者の編集か外からか）で変わるのは、型が合わない値の prune だけになったことを README に書く。`dynamicAdvanced`（もとは `e2e-dynamic`）の「利用者の編集として書き込む」ボタンで確かめる。

### L6. clear は描かれている欄だけに効くことを README に書く

clear は enum の部品が消すので、描かれていない欄（union の選ばれていない腕など）の値は消さない。

### L7. 表の並べ替えの基準を列の種類ごとに決める（zod-form-widget の AutoTable）

今は生の値で並ぶ（拠点は ID 順、担当は ID 順、金額は円とセントを同じ数として比べる）。小計（computed）は並べ替えできない。

| 列 | 並べ方 |
|---|---|
| 数・日付・時刻・文字・真偽 | 値で並べる（今のまま） |
| select（enum） | 選択肢を定義した順。選択肢に無い値は最後 |
| externalKey | 保存している値（ID）で並べる（表示名では並べないと決めた。README に書く） |
| computed | 計算した値。計算した値の型で上の決まりに従う |
| dynamic | 並べ替えできない（行ごとに意味が変わるため） |

### L8. README から公開リポジトリで使わない語を消す

`packages/zod-form/README.ja.md` の 85〜88 行。

## 足した e2e のケース

すでにある e2e（`external-key-filter.spec.ts`・`select-and-external-key.spec.ts`・`dynamic-advanced.spec.ts`・`table-view.spec.ts`・`date.spec.ts`・`time.spec.ts`）は残す。足したケースでは、それらが確かめていない時機や組み合わせを確かめる。

### 4. 選択肢の届き方（`externalKeyFilter`・`dynamicAdvanced`）

もとは e2e 用のページ `e2e-external-key`。デモページ「zf.externalKey（絞り込み）」に移した（spec は `external-key-filter.spec.ts`）。上限が変わる数量だけは、「zf.dynamic（読み込み・購読・連動）」の在庫の欄で確かめる（spec は `dynamic-advanced.spec.ts`）。

ページ：画面の部署（context）で絞る担当者（clear・keep の 2 つ）、同じく絞る複数選択の見守る人（clear・keep の 2 つ。`array_multipleExternalKey` も dynamic の上に作る）、config の key で取り直すレビュー担当、無い topic の欄（送信を止めるので、「無い topic の欄を出す」をオンにしたときだけ描く）。「動きを試す」の枠に、遅延の分け方の選択と、止めておく分け方の「届ける」「失敗させる」ボタン、取得を失敗させるスイッチ、選択肢を 0 件にする・戻すボタン、無い topic の欄のスイッチ。担当者・見守る人の初期値は鈴木 一郎（u-003）

e2e：
- 選択肢を止めておいたまま部署を変え、そのあと届けると、clear の欄は外れた値を消し、keep の欄は残して「（不正な値）」とエラーを出す
- 選択肢を止めておいたまま送信すると止まり、「読み込み中の欄があるため、送信できませんでした」が出る（L2）
- 同じ購読のまま選択肢が 0 件になると、clear の欄は消え、keep の欄は残る。戻すと keep の欄のエラーが消える
- 失敗させると「再試行」が出て送信が止まり、「取得できなかった欄があるため、送信できませんでした」が出る。失敗をやめて再試行すると戻る
- 無い topic の欄は「再試行」が出る（L3）
- clear で消えた欄には、触る前は必須のエラーが出ない。送信すると出る（L1）
- 上限が変わると、上限を超えたときだけエラーになり、値は消えない（`dynamicAdvanced` の在庫の欄。3 秒ごとに変えるスイッチをオフにし、ボタンで在庫を 3・10 にする）
- すぐ届く・1 フレーム後・2 フレーム後のそれぞれで、上の値の結果が同じになる
- 複数選択の欄も、止めておくと読み込み中になり、失敗させると「再試行」が出て送信が止まる。0 件にして戻すと clear の欄は外れた値だけを消し、keep の欄は「（不正な値）」のチップを残す。チップは × で消せる

### 5. `e2e-open-rewrite`：開いただけで書き換えるもの

ただ一つ残す e2e 用のページ。わざと選択肢に無い初期値や type の無い古い形の初期値を持たせるので、人が見るデモには向かない。

ページ：選択肢に無い初期値を持つ clear の欄と keep の欄、type の無い古い形の初期値を持つ preprocess の union、precision の欄

e2e：
- 開くと、clear の欄の値は消え、keep の欄は残ってエラーが出る
- preprocess の union は、開くと `type` が補われた形になる
- precision の欄の値は初期値のまま
- 上のどれでも、開いただけでは isDirty は false（L1）
- 欄を 1 つ編集すると isDirty が true になる

### 6. union の腕の切り替え（`discriminatedUnion`）

もとは e2e 用のページ `e2e-union`。デモページ「z.discriminatedUnion」の窓口の欄に移した（spec は `discriminated-union.spec.ts`）。

今のふるまい（`union.tsx`）：腕を切り替えると、新しい腕の既定の値に、今の値のうち新しい腕にもある項目を重ね、判別の値を入れる。前の腕だけにあった項目は消える。

ページ：判別の値で腕が変わる discriminatedUnion（窓口。腕どうしで共通の名前・備考と、腕ごとの項目を持つ）と、オンラインの腕の clear の選択の欄（チャネル）。「動きを試す」の枠に、チャネルの選択肢からチャットを外す・戻すボタン

e2e：
- 腕を切り替えると、共通の項目は残り、前の腕だけの項目は消え、新しい腕の既定の値が入る
- 元の腕に戻すと、前の腕だけの項目は既定の値に戻る（前の値は戻らない）
- 選ばれていない腕の選択の欄は、選択肢が変わっても clear されない（描かれていないため。L6）
- 切り替えたあと、新しい腕の必須の欄は、触る前はエラーを出さない

### 7. 表（`tableView`）

もとは e2e 用のページ `e2e-table`。デモページ「表（AutoTable）」に移した（spec は `table-view.spec.ts`）。

ページ：数・日付（期限）・select・externalKey・computed・dynamic（行の通貨で表示が変わる金額）の列を持つ表。選択肢に無い値を状態と担当に持つ行（r4）を含める

e2e：
- 各列の並べ替えが L7 の決まりに従う（昇順・降順）
- dynamic の列は並べ替えの印が出ず、見出しを押しても順が変わらない
- dynamic のセルは行の通貨で表示が変わる
- 選択肢に無い値のセルは「（不正な値）」と出る

## e2e の実行まわり

- `playwright.config.ts` のポートを環境変数（例：`E2E_PORT`、既定 3000）で変えられるようにする。別の作業コピーの dev サーバーを相手にテストしてしまうのを防ぐ
- `all-pages.spec.ts` に、`e2eSchemas` のページもすべて開け、例外が起きないことを足す（サイドバーのリンクからはたどれないため、formId の一覧をテストから読む）。今は `e2e-open-rewrite` だけ
- 読み込み中の操作は止めておく分け方で作るので、待ち時間に頼らない。フレームの分け方で揺れるケースが出たら、単体テストに回す

## ドキュメント

- `apps/form-demo/AGENT.md`・README に、e2e のページの置き場所、メニューに出ないこと、手順をページの説明とそろえること、見るための共通の部品と `window.__formDemo`・ログの読み方を書く

## 進め方

1. モックの externalKey の変更（zod-form）と、それに合わせた公開のデモの直し（実装中）
2. externalKey の取得の失敗を dynamic の失敗につなぐ（実装中）
3. 登録簿・詳細ページの引き方・見るための共通の部品（直接読むルートとログを含む、全ページ）・ポートの環境変数・all-pages の追加（実装中）
4. `e2e-dynamic`・`e2e-time-input`・`e2e-precision` のページと e2e（実装中）
5. ライブラリの直し L1〜L8（項目ごとに別のコミット）
6. `e2e-external-key`・`e2e-open-rewrite`・`e2e-union`・`e2e-table` のページと e2e
   - あとから：e2e のケースを重なるデモページに移し、e2e 用のページは `e2e-open-rewrite` だけを残す（「e2e のケースの置き場所」の節。済み）
7. ドキュメント（e2e のページの置き場所と読み方、L1・L4・L5・L6 の README）
8. push して PR #21 を更新

各段階で `pnpm check-types`・関係するパッケージの単体テスト・`pnpm --filter form-demo build`・form-demo の e2e を通してからコミットする。
