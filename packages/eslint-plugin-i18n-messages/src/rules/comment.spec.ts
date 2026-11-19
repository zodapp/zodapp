import path from "node:path";
import { RuleTester } from "eslint";
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
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("comment", rule, {
  valid: [
    { code: 'msg("test.title" /* タイトル */);', options },
    {
      code: 'msgKey("test.rowCount" /* ${count} 件 */, { count: 1 });',
      options,
    },
    // msgKey の書式（key?params）でも、キーで引く
    { code: 'f(msgKey("test.rowCount?count=1" /* ${count} 件 */));', options },
    { code: 'msg("test.block" /* 全${count}件 */, { count: 1 });', options },
    // 空白の違いは無視する
    {
      code: 'msg("test.conditional" /* p.inclusive === "true" ? `${p.minimum}以上` : `${p.minimum}より大きい` */, p);',
      options,
    },
    { code: 'msg("test.multiline" /* 1行目\\n2行目 */);', options },
    { code: 'msg("test.special" /* a *\\/ b \\\\ c */);', options },
    { code: 'msg("other.ok" /* OK */);', options },
    // 対象の外：名前空間が無い・関数名が違う・キーがリテラルでない
    { code: 'msg("unknownNamespace.key");', options },
    { code: 't("test.title");', options },
    { code: "msg(key);", options },
    // 辞書を指定しなければ何もしない
    { code: 'msg("test.title");' },
  ],
  invalid: [
    {
      code: 'msg("test.title");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.title" /* タイトル */);',
    },
    {
      code: 'msg("test.title" /* 古い文言 */);',
      options,
      errors: [{ messageId: "mismatch" }],
      output: 'msg("test.title" /* タイトル */);',
    },
    {
      code: 'msg("test.rowCount", { count: 1 });',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.rowCount" /* ${count} 件 */, { count: 1 });',
    },
    {
      code: 'msg("test.title" /* タイ */ /* トル */);',
      options,
      errors: [{ messageId: "malformed" }],
      output: 'msg("test.title" /* タイトル */);',
    },
    {
      code: 'msg("test.title" /* タイ\n トル */);',
      options,
      errors: [{ messageId: "malformed" }],
      output: 'msg("test.title" /* タイトル */);',
    },
    {
      code: 'msg(\n  "test.title" // タイトル\n);',
      options,
      errors: [{ messageId: "malformed" }],
      output: 'msg(\n  "test.title" /* タイトル */\n);',
    },
    {
      code: 'msg("test.multiline");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.multiline" /* 1行目\\n2行目 */);',
    },
    {
      code: 'msg("test.special");',
      options,
      errors: [{ messageId: "missing" }],
      output: 'msg("test.special" /* a *\\/ b \\\\ c */);',
    },
    {
      code: 'msg("test.title" /* \\t */);',
      options,
      errors: [{ messageId: "invalidEscape" }],
      output: null,
    },
    {
      code: 'msg("test.nothing");',
      options,
      errors: [{ messageId: "unknownKey" }],
      output: null,
    },
    {
      code: 'translate("test.title");',
      options: [{ ...options[0], callees: ["translate"] }],
      errors: [{ messageId: "missing" }],
      output: 'translate("test.title" /* タイトル */);',
    },
  ],
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
