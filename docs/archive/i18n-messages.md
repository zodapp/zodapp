# UI 文言を差し替え可能にする（i18n-messages）

今の仕様は、各パッケージの README（[i18n-messages](../../packages/i18n-messages/README.ja.md)・i18n-messages-react・i18n-messages-zod・eslint-plugin-i18n-messages）と、[ライブラリが文言を持つときの決まり](../../packages/i18n-messages/docs/library-messages.ja.md) にあります。

## 目的

zod-form 系のパッケージの文言（約 180 か所）とロケール（dayjs・`toLocaleString`・`localeCompare`）が日本語に固定されていたのを、利用者が差し替えられるようにする。

## 決めたこと

- **zod-form から独立した i18n のパッケージとして作る。** 本体・React・zod・ESLint に分ける（zod-form と zod-form-react と同じ分け方）
- **i18next や react-intl には依存しない。** 相互運用は `messagesFromTranslator(t)` 1 つにする
- **辞書の型は `RegisteredMessages` に module augmentation で足す。** `msg` と `msgKey` は登録されたキーと params で型検査する。型の基準は en の辞書にする
- **エラーの文言は `key?a=1&b=2` の文字列にし、表示するときに辞書で引く。** zod の issue・throw・meta の label など、どの経路でも同じに扱え、キーでなければそのまま出る。zod の既定のエラーは、こちらで決めた `zod.*` のキーに変換する（zod の issue の形に依存するのはこのマップの中だけ）
- **優先順位は「props で渡した値 > Provider の辞書 > パッケージの既定（en）」。** Provider が無いときは英語
- **専用の `I18nMessagesProvider` にする。** 既存の `ZodFormContextProvider` には足さない
- **開発者向けの文言は辞書に入れず、英語にする**
- **呼び出し側の読みやすさは、キーの直後のコメントで補う（`msg("k" /* 送信 */)`）。** ESLint で辞書と突き合わせ、`--fix` で書き込む。実行時のコストはかからない
- **キーにプレフィックスの印は付けない。** 辞書のキーと完全に一致したときだけ訳すので、名前空間付きのキーが普通の文章と重なることはまず無い。代わりに、キーは `msg`・`msgKey` を通して書くことを運用ルールにする
- サーバーのエラーは訳さない（zod の既定の英語のまま）
