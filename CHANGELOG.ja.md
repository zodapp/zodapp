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
