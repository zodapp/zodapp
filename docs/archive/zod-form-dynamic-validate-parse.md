# dynamic の検証と送信を 1 つの評価にそろえる

今の仕様は [zf.dynamic の値](../../packages/zod-form-react/docs/dynamic.ja.md) の「検証と送信する値（`FormRuntime.evaluate`）」にあります。

## 目的

`zf.dynamic()` の土台を `z.unknown()` にしたことで、`FormRuntime` の `validate`（エラーの表示と送信の可否）と `parse`（送信する値）が違う値を見ていることが表に出た。validate は生の値で静的な schema を検証し、parse は dynamic の output を差し込んでから parse していた。そのため、dynamic が変換すると親の `.refine()` が正しい値でも落ちる、親の refine が dynamic の欄を指すと「エラーが出ないまま送信できない」、dynamic が読み込み中・不正でも親の refine が生の値で走る、が起きていた。2 つが同じ評価を読むようにして、ずれを無くす。

## 決めたこと

- **値を 1 回評価する `FormRuntime.evaluate` を置き、`validate`・`parse` はその結果を読むだけにする。** 登録を深い順に `safeParse` し、output をコピーの値に差し込んでから静的な schema で parse する。検査はすべて zod に任せ、自前で持つのは順番と差し込みだけ
- **dynamic が通らない・読み込み中・取得失敗の所には目印（`DYNAMIC_UNRESOLVED`）を差し込む。** dynamic の土台に、目印だけを弾く `abort: true` の検査を足し、親の refine を止める。失敗の種類（`min()` のような続けられるものでも）によらず止める。親は変換後の値を前提にしているため。目印は評価のコピーにだけ入るので、サーバーで同じ schema を parse しても検査は必ず通る
- **目印を弾いた issue だけを捨てる。** `invalid_union` の腕の中も再帰的に捨てる。登録のある path の下の静的な issue をまとめて捨てる仕組み（`isCovered`）はやめ、親の refine が dynamic の欄を指したエラーを出す。union の腕の中で dynamic が失敗し、別の腕で通ってしまうのは許す（送信は dynamic 自身の issue で止まる）
- **externalKey の欄の登録でも、目印は静的な `z.string()` に型の誤りとして弾かれる。** `reportInput: true` で input が目印の issue も捨てる
- **`parse` の失敗は全部の issue を返す。** AutoForm の「検証は通ったのに parse で落ちた」ための `parseIssuesRef` は消し、送信が止まった理由は `evaluate` の issue から出す。survey の SurveyBuilder も runtime を通して parse する
- **扱わないもの。** 同じ path の入れ子の dynamic を `FormRuntime` に手で登録した場合（画面では外側の検査が内側の登録に入っているので困らない）、評価の結果の使い回し、AutoSearch の `onChange` に parse していない値が渡る件、dynamic を resolve した schema で全体を組み立てて 1 回で parse する形（配列の要素ごとに schema が変わり、組み立てられない）
