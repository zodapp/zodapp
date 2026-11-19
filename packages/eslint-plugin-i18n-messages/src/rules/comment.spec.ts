import path from "node:path";
import tsParser from "@typescript-eslint/parser";
import { Linter, RuleTester } from "eslint";
import { describe, expect, it } from "vitest";
import { parseDictionary } from "../dictionary.js";
import { escapeCommentText, unescapeCommentText } from "../escape.js";
import rule from "./comment.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const fixtures = path.join(import.meta.dirname, "../__fixtures__");
const options = [
  {
    dictionaries: {
      "test.": path.join(fixtures, "ja.ts"),
      "other.": path.join(fixtures, "other.ts"),
    },
  },
];

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("comment", rule, {
  valid: [
    { code: 'msg("test.title" /* i18n: タイトル */);', options },
    {
      code: 'msgKey("test.rowCount" /* i18n: ${count} 件 */, { count: 1 });',
      options,
    },
    // msgKey の書式（key?params）でも、キーで引く
    {
      code: 'f(msgKey("test.rowCount?count=1" /* i18n: ${count} 件 */));',
      options,
    },
    {
      code: 'msg("test.block" /* i18n: 全${count}件 */, { count: 1 });',
      options,
    },
    // 空白の違いは無視する
    {
      code: 'msg("test.conditional" /* i18n: p.inclusive === "true" ? `${p.minimum}以上` : `${p.minimum}より大きい` */, p);',
      options,
    },
    { code: 'msg("test.multiline" /* i18n: 1行目\\n2行目 */);', options },
    { code: 'msg("test.special" /* i18n: a *\\/ b \\\\ c */);', options },
    { code: 'msg("other.ok" /* i18n: OK */);', options },
    { code: 'msg("test.empty" /* i18n: */);', options },
    // 関数の名前は見ない。キーの形の文字列なら、どこにあっても確かめる
    { code: 't("test.title" /* i18n: タイトル */);', options },
    { code: 'const pair = ["test.title" /* i18n: タイトル */, {}];', options },
    { code: "const k = `test.title` /* i18n: タイトル */;", options },
    { code: 'useMsg()("test.title" /* i18n: タイトル */);', options },
    {
      code: 'const el = <A label={"test.title" /* i18n: タイトル */} />;',
      options,
    },
    // 目印の無いコメント・行コメントには触らない
    { code: 'msg("test.title" /* i18n: タイトル */ /* メモ */);', options },
    { code: 'msg("test.title" /* i18n: タイトル */); // メモ', options },
    { code: 'const s = "hello" /* タイトル */; // i18n: x', options },
    // 対象の外：名前空間が無い・キーの形でない・キーがリテラルでない・${} を含む
    { code: 'msg("unknownNamespace.key");', options },
    { code: 'const url = "test.dev/docs";', options },
    { code: 'const s = "test.title ";', options },
    { code: 'const s = "test.title.";', options },
    { code: 'const s = "test.";', options },
    { code: 'const s = "test.a b";', options },
    { code: "msg(key);", options },
    { code: "const k = `test.${name}`;", options },
    // 見ない場所：オブジェクトのキー・import・export・タグ付きテンプレート
    { code: 'const dict = { "test.title": "タイトル" };', options },
    { code: 'import x from "test.title";', options },
    { code: 'export * from "test.title";', options },
    { code: "tag`test.title`;", options },
    // 型の位置
    {
      code: 'type K = "test.title"; interface I { "test.title": string }',
      options,
      languageOptions: { parser: tsParser },
    },
    // 辞書を指定しなければ何もしない
    { code: 'msg("test.title");' },
  ],
  invalid: [
    {
      code: 'msg("test.title");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.title" /* i18n: タイトル */);',
    },
    {
      code: 'msg("test.title" /* i18n: 古い文言 */);',
      options,
      errors: [{ messageId: "mismatch" }],
      output: 'msg("test.title" /* i18n: タイトル */);',
    },
    {
      code: 'msg("test.rowCount", { count: 1 });',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.rowCount" /* i18n: ${count} 件 */, { count: 1 });',
    },
    {
      code: 'msg("test.title" /* i18n: タイ */ /* i18n: トル */);',
      options,
      errors: [{ messageId: "malformed" }],
      output: 'msg("test.title" /* i18n: タイトル */);',
    },
    {
      code: 'msg("test.title" /* i18n: タイ\n トル */);',
      options,
      errors: [{ messageId: "malformed" }],
      output: 'msg("test.title" /* i18n: タイトル */);',
    },
    // 行コメント・普通のブロックコメントは残し、目印付きのコメントをキーのすぐ後ろに書く
    {
      code: 'msg(\n  "test.title" // タイトル\n);',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg(\n  "test.title" /* i18n: タイトル */ // タイトル\n);',
    },
    {
      code: 'msg("test.title" /* あとで直す */);',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.title" /* i18n: タイトル */ /* あとで直す */);',
    },
    // 目印付きのコメントだけを置き換える
    {
      code: 'msg("test.title" /* あとで直す */ /* i18n: 古い */);',
      options,
      errors: [{ messageId: "mismatch" }],
      output: 'msg("test.title" /* あとで直す */ /* i18n: タイトル */);',
    },
    {
      code: 'msg("test.title" /* i18n: タイ */ /* メモ */ /* i18n: トル */);',
      options,
      errors: [{ messageId: "malformed" }],
      output: 'msg("test.title" /* i18n: タイトル */ /* メモ */);',
    },
    // キーのすぐ後ろ以外にある目印付きのコメントは消す。前後のトークンはくっつけない
    {
      code: "const t = typeof /* i18n: タイトル */value;",
      options,
      errors: [{ messageId: "orphan" }],
      output: "const t = typeof value;",
    },
    {
      code: "const t = a+/* i18n: タイトル */+b;",
      options,
      errors: [{ messageId: "orphan" }],
      output: "const t = a+ +b;",
    },
    {
      code: 'const s = "hello" /* i18n: タイトル */;',
      options,
      errors: [{ messageId: "orphan" }],
      output: 'const s = "hello";',
    },
    {
      code: "msg(key /* i18n: タイトル */);",
      options,
      errors: [{ messageId: "orphan" }],
      output: "msg(key);",
    },
    {
      code: 'const dict = { "test.title" /* i18n: タイトル */: "x" };',
      options,
      errors: [{ messageId: "orphan" }],
      output: 'const dict = { "test.title": "x" };',
    },
    {
      code: 'msg("test.multiline");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.multiline" /* i18n: 1行目\\n2行目 */);',
    },
    {
      code: 'msg("test.special");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.special" /* i18n: a *\\/ b \\\\ c */);',
    },
    {
      code: 'msg("test.title" /* i18n: \\t */);',
      options,
      errors: [{ messageId: "invalidEscape" }],
      output: null,
    },
    {
      code: 'msg("test.empty");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.empty" /* i18n: */);',
    },
    {
      code: 'msg("test.conditional");',
      options,
      errors: [{ messageId: "missing" }],
      output:
        'msg("test.conditional" /* i18n: p.inclusive === "true" ? `${p.minimum}以上` : `${p.minimum}より大きい` */);',
    },
    {
      code: 'msg("test.nothing");',
      options,
      errors: [{ messageId: "unknownKey" }],
      output: null,
    },
    // 関数を挟んだ呼び出し・タプル・配列・名前でない呼び出し
    {
      code: 'translate("test.title");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'translate("test.title" /* i18n: タイトル */);',
    },
    {
      code: 'const pair = ["test.rowCount", { count: "1" }];',
      options,
      errors: [{ messageId: "missing" }],
      output:
        'const pair = ["test.rowCount" /* i18n: ${count} 件 */, { count: "1" }];',
    },
    {
      code: 'const keys = ["test.title", "other.ok"];',
      options,
      errors: [{ messageId: "missing" }, { messageId: "missing" }],
      output:
        'const keys = ["test.title" /* i18n: タイトル */, "other.ok" /* i18n: OK */];',
    },
    {
      code: 'useMsg()("test.title");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'useMsg()("test.title" /* i18n: タイトル */);',
    },
    {
      code: "const k = `test.title`;",
      options,
      errors: [{ messageId: "missing" }],
      output: "const k = `test.title` /* i18n: タイトル */;",
    },
    {
      code: 'const label = "test.rowCount?count=1";',
      options,
      errors: [{ messageId: "missing" }],
      output: 'const label = "test.rowCount?count=1" /* i18n: ${count} 件 */;',
    },
    {
      code: 'const v = { label: "test.nothing" };',
      options,
      errors: [{ messageId: "unknownKey" }],
      output: null,
    },
    // JSX の属性の値は {} で包む
    {
      code: 'const el = <A label="test.title" />;',
      options,
      errors: [{ messageId: "missing" }],
      output: 'const el = <A label={"test.title" /* i18n: タイトル */} />;',
    },
    // 実体参照を含む JSX の属性は、値を JS の文字列にする
    {
      code: 'const el = <A label="test.rowCount?name=Tom&amp;count=2" />;',
      options,
      errors: [{ messageId: "missing" }],
      output:
        'const el = <A label={"test.rowCount?name=Tom&count=2" /* i18n: ${count} 件 */} />;',
    },
    // 型の位置でない TS の文字列は確かめる
    {
      code: 'const k = "test.title" as const;',
      options,
      languageOptions: { parser: tsParser },
      errors: [{ messageId: "missing" }],
      output: 'const k = "test.title" /* i18n: タイトル */ as const;',
    },
  ],
});

describe("dictionaries のプレフィックス", () => {
  it.each(["test", "test.a", ".test.", "1test.", "te-st.", "test..", ""])(
    "形が違えば設定の誤りとして投げる: %s",
    (prefix) => {
      const linter = new Linter({ configType: "flat" });
      expect(() =>
        linter.verify('msg("x");', [
          {
            plugins: { i18n: { rules: { comment: rule } } },
            rules: {
              "i18n/comment": [
                "warn",
                { dictionaries: { [prefix]: path.join(fixtures, "ja.ts") } },
              ],
            },
          },
        ]),
      ).toThrow(/prefix/);
    },
  );

  it("入れ子のプレフィックスを使える", () => {
    const linter = new Linter({ configType: "flat" });
    const messages = linter.verify('msg("test.title");', [
      {
        plugins: { i18n: { rules: { comment: rule } } },
        rules: {
          "i18n/comment": [
            "warn",
            { dictionaries: { "my.test.": path.join(fixtures, "ja.ts") } },
          ],
        },
      },
    ]);
    expect(messages).toEqual([]);
  });
});

describe("parseDictionary", () => {
  it("referenceLocale の名前の変数を辞書にする。無ければ最初のオブジェクト", () => {
    const source = `
      export const en = defineMessages({ "a.b": "B" });
      export const ja = { "a.b": "ビー" } satisfies X;
    `;
    expect(parseDictionary(source, "x.ts", "ja").get("a.b")).toBe("ビー");
    expect(parseDictionary(source, "x.ts", "fr").get("a.b")).toBe("B");
  });
});

describe("escape", () => {
  it.each(["a */ b", "a\\nb", "1\n2", "\\", "*\\/"])("戻せる: %s", (text) => {
    expect(unescapeCommentText(escapeCommentText(text))).toBe(text);
    expect(escapeCommentText(text)).not.toContain("*/");
  });

  it("知らないエスケープは null", () => {
    expect(unescapeCommentText("\\t")).toBeNull();
    expect(unescapeCommentText("\\/")).toBeNull();
  });
});
