# @zodapp/eslint-plugin-i18n-messages

`@zodapp/i18n-messages` の辞書のキーの直後に、基準の言語（既定は日本語）の文言をコメントで書かせる ESLint のプラグインです。コードを読むときに辞書を開かずに済み、コメントはビルドで消えるのでバンドルの大きさにも影響しません。

```ts
msg("zodFormWidget.import.title" /* データインポート */);
msgKey("myapp.nameTooShort" /* ${length}文字以上で入力 */, { length: 3 });
```

## インストール

```bash
pnpm add -D @zodapp/eslint-plugin-i18n-messages
```

## 設定

```js
// eslint.config.mjs
import i18nMessages from "@zodapp/eslint-plugin-i18n-messages";

export default [
  {
    plugins: { "@zodapp/i18n-messages": i18nMessages },
    rules: {
      "@zodapp/i18n-messages/comment": [
        "warn",
        {
          callees: ["msg", "msgKey"],
          referenceLocale: "ja",
          dictionaries: {
            "myapp.": "src/messages/ja.ts",
          },
        },
      ],
    },
  },
];
```

- `callees`：対象の関数名（既定 `["msg", "msgKey"]`）。名前だけで絞ります（別名の import は拾いません）。第 1 引数が文字列リテラルの呼び出しだけを見ます。
- `referenceLocale`：辞書のファイルの中で、この名前の変数（`export const ja = { … }`）を辞書にします。無ければ最初に見つかったオブジェクトリテラル（`defineMessages({ … })` など）を使います（既定 `"ja"`）。
- `dictionaries`：キーの名前空間（前方一致、長いものが優先）と、基準の言語の辞書のファイル。相対パスは ESLint の cwd から解決します。名前空間に当てはまらないキーは見ません。

## ルール `comment`

キーの直後（カンマの前）の **1 つの 1 行のブロックコメント** だけを見ます。

| 状態 | 結果 | `--fix` |
| --- | --- | --- |
| コメントが無い | 警告 | 辞書の文言を書き込む |
| 辞書と食い違う | 警告 | 書き直す |
| 2 つ以上ある・改行を含む・行コメント | 警告 | 1 つにまとめる |
| 知らないエスケープがある | 警告 | しない |
| 辞書に無いキー | 警告 | しない |

書き込む文言は、辞書の項目のソースから作ります（辞書は実行しません）。

- 文字列リテラル → その値
- 本体がテンプレートリテラル（か文字列リテラル）だけの関数 → テンプレートの中身（`${count} 件を取り込み予定`）
- それ以外 → 本体のソースそのまま

コメントの中では `\\`（`\`）、`\n`（改行）、`*\/`（`*/`）だけをエスケープします。突き合わせでは、エスケープを戻し、空白の連続を 1 つにまとめ、前後を取り除いてから比べます。

辞書は、静的なオブジェクトリテラルで書いてください。スプレッドや計算したキーは追えません。

## 性能

見るのは `CallExpression` だけで、型情報は使いません。辞書は構文木を作ってキャッシュし、ファイルの mtime が変わったときだけ読み直します。
