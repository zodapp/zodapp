## 変更履歴（Changelog）

本プロジェクトの主な変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に基づき、
また可能な限り [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に従います。

## 未リリース（Unreleased）

- OSS公開の初期リリース準備
- zod-dynamodb: サーバーのコードが `live` のクエリを購読する `subscribeOnServer` を追加。サーバー専用のクエリ（`authorize` なし）にも `live` を付けられるようにした（Realtime Gateway は公開しない）
- taskmanager: メンバーの変更を revocations として配り、Realtime Gateway が複数の台でも、すべての台で接続の認証コンテキストを作り直すようにした
- zod-transform: intersection で、left 側の変換結果が right 側の素通しした値で上書きされる不具合を修正。あわせて、片側が `$remove` したキーは、もう片側が素通ししただけなら取り除くように変更
