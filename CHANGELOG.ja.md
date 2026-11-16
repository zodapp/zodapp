## 変更履歴（Changelog）

本プロジェクトの主な変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に基づき、
また可能な限り [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に従います。

## 未リリース（Unreleased）

- OSS公開の初期リリース準備
- zod-dynamodb: サーバーのコードが `live` のクエリを購読する `subscribeOnServer` を追加。サーバー専用のクエリ（`authorize` なし）にも `live` を付けられるようにした（Realtime Gateway は公開しない）
- taskmanager: メンバーの変更を revocations として配り、Realtime Gateway が複数の台でも、すべての台で接続の認証コンテキストを作り直すようにした
- zod-transform: intersection で、left 側の変換結果が right 側の素通しした値で上書きされる不具合を修正。あわせて、片側が `$remove` したキーは、もう片側が素通ししただけなら取り除くように変更
- zod-form-widget: AutoForm を `<form>` 要素で包み、入力欄で Enter を押すと送信できるようにした。Enter で押されるのは、最初の `type: "submit"` のアクション（`onSubmit` prop の送信ボタンを含む）で、そのボタンは HTML の `type="submit"` で描く。`custom` のアクションを Enter の対象にするときは、ボタンに `type="submit"` を付ける。**振る舞いの変更**：送信ボタンのある AutoForm では、テキスト欄で Enter を押すと送信されるようになる（テキストエリアは改行のまま）
- zod-form-widget: AutoForm に `actionsPosition`（`"top"` | `"bottom"`、既定は `"top"`）を追加し、ボタンの行を入力欄の下にも置けるようにした
- taskmanager・survey: ログイン・新規登録・確認コード・パスワード再設定の画面で、ボタンを入力欄の下に横幅いっぱいで置くようにした
- zod-form-mantine: `uiType: "badge"` の enum で、選択肢だけでなく選択済みの値もバッジで出すようにした。ドロップダウンを開いている間は文字入力になり（選択済みのラベルを placeholder に出す）、打ち込んだ文字で絞り込む。打ち込んだ文字が選択済みのラベルに足されることもなくなった。読み取り専用表示もバッジにした。`@zodapp/zod-form-mantine-lite/utils` に追加した `BadgeSelect` で組んでいる
- zod-form-mantine: `uiType: "multipleEnumBadge"` で、選択済みの値も × で外せるバッジで出し、読み取り専用表示もバッジにした
- zod-form-mantine: **破壊的変更**：`uiType: "multipleEnumBudge"` を `"multipleEnumBadge"` に改名（旧綴りは認識しない）
- zod-form-mantine-lite: バッジ（enum の選択肢・選択済み・読み取り専用、複数選択、表の computed のバッジ）の文字色を背景色から決めるようにした。濃さ付きのテーマ色（`"blue.6"`）や RGB（`#3b82f6`・`rgb()`・`hsl()`）の指定では、背景をその色そのものにし、文字は同じ色相で背景より暗い色（OKLCH の明るさを 0.45 下げた色）、暗い背景や白の方が見やすい背景では白にする。濃さなしのテーマ色（`"blue"`）は今の Mantine の `light` のまま。`@zodapp/zod-form-mantine-lite/utils` に `ColorBadge`・`computeBadgeColors` を追加
- zod-form-mantine: discriminator のない union（`zf.union`）で、object の腕を選ぶとセレクトが空欄に戻り、腕の欄が出ない不具合を修正。選んだ腕を覚え、値がまだ腕の検証に通らなくてもその腕を出す。値が外から変わり、別の腕にだけ通るようになったらその腕に切り替える。初期値がどの腕にも通らないときは、object の腕の literal の欄（例: `type: "phone"`）が一致する腕を 1 つに絞れればそれを出す。腕の切り替えでは、discriminatedUnion と同じく検証しない
