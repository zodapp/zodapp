# @zodapp/eslint-plugin-i18n-messages

[日本語](README.ja.md)

An ESLint plugin that makes you write the reference-language text (Japanese by default) as a comment right after each `@zodapp/i18n-messages` dictionary key. You can read code without opening the dictionary, and since comments are stripped at build time, the bundle size is not affected.

```ts
msg("zodFormWidget.import.title" /* i18n: データインポート */);
msgKey("myapp.nameTooShort" /* i18n: ${length}文字以上で入力 */, { length: 3 });
const pair = ["zod.required" /* i18n: 必ず入力してください。 */, {}];
```

## Installation

```bash
pnpm add -D @zodapp/eslint-plugin-i18n-messages
```

## Configuration

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

- `dictionaries`: key prefixes and the dictionary file of the reference language. Relative paths are resolved from ESLint's cwd. Write prefixes as identifiers ending with a dot, like `myapp.` or `myapp.admin.` (`^([A-Za-z][A-Za-z0-9]*\.)+$`). A prefix of any other form throws a configuration error when the rule starts. When prefixes overlap, the longer one is used.
- `referenceLocale`: in the dictionary file, the variable with this name (`export const ja = { … }`) is used as the dictionary. If there is none, the first object literal found (such as `defineMessages({ … })`) is used (default `"ja"`).

## How keys are found

Function names are not looked at. A string of the form below is checked as a key wherever it is written, including arguments of functions that receive and pass on keys, tuples, arrays, object values, and JSX attributes.

- A string literal, or a template literal without `${}`
- The whole value is "prefix + `[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*`", optionally followed by `?params` in the `msgKey` format

`"myapp.dev/docs"` (contains a slash), `"myapp.title "` (contains a space), and `"myapp."` (nothing after the prefix) are not treated as keys.

Strings in these places are not looked at:

- Object keys (such as `"myapp.title": …` in a dictionary)
- `from "…"` of import / export
- Type positions (`type K = "myapp.title"`)
- Tagged templates

Keys assembled like `` `myapp.${code}` `` cannot be checked.

## Rule `comment`

The rule only handles **block comments with the `i18n:` marker**. Comments without the marker and line comments are neither read nor removed.

| State | Report | `--fix` |
| --- | --- | --- |
| No marked comment after the key | `missing` | Writes one right after the key (before any other comments) |
| Disagrees with the dictionary | `mismatch` | Rewrites only the marked comment |
| Two or more marked comments, or one containing a newline | `malformed` | Merges them into one |
| Contains an unknown escape | `invalidEscape` | None |
| Key not in the dictionary | `unknownKey` | None |
| A marked comment somewhere other than right after a key | `orphan` | Removes it |

"Right after the key" means between the key string and the next token (a comma, a closing parenthesis, etc.). A marked comment left behind after the key is removed or rewritten into a non-key string becomes `orphan`.

A JSX attribute value (`label="myapp.title"`) cannot have a comment after it, so `--fix` rewrites it to `label={"myapp.title" /* i18n: タイトル */}`.

The written text is built from the source of the dictionary entry (the dictionary is not executed).

- A string literal → its value
- A function whose body is only a template literal (or a string literal) → the template's contents (`${count} 件を取り込み予定`)
- Anything else → the source of the body (newlines and indentation collapsed into a single space)
- An empty string → `/* i18n: */`

Inside comments, only `\\` (`\`), `\n` (newline), and `*\/` (`*/`) are escaped. When comparing, escapes are undone, runs of whitespace are collapsed into one, and leading and trailing whitespace is trimmed.

Write dictionaries as static object literals. Spreads and computed keys cannot be followed.

## Performance

It looks at each string literal and template literal only once and does not use type information. Dictionaries are parsed into syntax trees and cached, and re-read only when the file's mtime changes.

## License

MIT ([`LICENSE`](../../LICENSE))
