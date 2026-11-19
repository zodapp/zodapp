// @ts-check
import path from "node:path";
import { loadDictionary } from "../dictionary.js";
import {
  escapeCommentText,
  normalizeForCompare,
  unescapeCommentText,
} from "../escape.js";

/**
 * @typedef {object} CommentRuleOptions
 * @property {string} [referenceLocale] 基準の言語。辞書のファイルの中で、この名前の変数を辞書とする（既定 `"ja"`）
 * @property {Record<string, string>} [dictionaries] キーのプレフィックス（`myapp.` のように、ドットで終わる識別子）と、基準の言語の辞書のファイル。相対パスは ESLint の cwd から
 */

/** ルールが書くコメントの目印。目印付きのブロックコメントだけをルールのものとみなす */
const MARKER = "i18n:";

/**
 * 目印付きのブロックコメントなら、目印の後ろの文言（エスケープしたまま）。それ以外は undefined。
 * `/* i18n: 文言 *\/` の目印の後ろの空白 1 つまでは目印に含める。
 *
 * @param {import("eslint").AST.Program["comments"][number]} comment
 * @returns {string | undefined}
 */
const markedTextOf = (comment) => {
  if (comment.type !== "Block") return undefined;
  const value = comment.value.trimStart();
  if (!value.startsWith(MARKER)) return undefined;
  return value.slice(MARKER.length).replace(/^ /, "");
};

/** プレフィックスの形：ドットで終わる 1 段以上の識別子 */
const PREFIX_PATTERN = /^(?:[A-Za-z][A-Za-z0-9]*\.)+$/;
/** プレフィックスの後ろの形：`.` 区切りの識別子と、msgKey の書式の `?params` */
const REST_PATTERN = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*(?:\?.*)?$/s;

/**
 * キーとして見ない場所にある文字列か。
 * オブジェクトのキー（辞書の `"zod.required": …`）、import・export の `from "…"`、型の位置、タグ付きテンプレート、ディレクティブ。
 *
 * @param {any} node
 * @returns {boolean}
 */
const isIgnoredPosition = (node) => {
  const parent = node.parent;
  if (!parent) return true;
  switch (parent.type) {
    case "Property":
    case "PropertyDefinition":
    case "MethodDefinition":
    case "TSPropertySignature":
    case "TSAbstractPropertyDefinition":
    case "TSEnumMember":
      return parent.key === node && !parent.computed;
    case "ImportDeclaration":
    case "ExportNamedDeclaration":
    case "ExportAllDeclaration":
    case "ImportExpression":
      return parent.source === node;
    case "ImportAttribute":
    case "TSExternalModuleReference":
    case "TSImportType":
    case "TSLiteralType":
    case "TSModuleDeclaration":
    case "TaggedTemplateExpression":
      return true;
    case "ExpressionStatement":
      return typeof parent.directive === "string";
    default:
      return false;
  }
};

/**
 * 文字列リテラル・`${}` を含まないテンプレートリテラルの値。それ以外は undefined。
 *
 * @param {any} node
 * @returns {string | undefined}
 */
const stringValueOf = (node) => {
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
};

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a comment with the reference-locale text right after a message key",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          referenceLocale: { type: "string" },
          dictionaries: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing: "Add the message text as a comment: /* {{text}} */",
      mismatch:
        "The comment does not match the dictionary. Expected: /* {{text}} */",
      malformed:
        "Write the message text as a single one-line block comment: /* {{text}} */",
      invalidEscape:
        "The comment has an unknown escape. Only \\\\, \\n and *\\/ are allowed.",
      unknownKey: 'The key "{{key}}" is not in the dictionary {{file}}.',
      orphan: "This i18n: comment does not follow a message key. Remove it.",
    },
  },

  create(context) {
    /** @type {CommentRuleOptions} */
    const options = context.options[0] ?? {};
    const referenceLocale = options.referenceLocale ?? "ja";
    const cwd = context.cwd;
    for (const prefix of Object.keys(options.dictionaries ?? {})) {
      if (!PREFIX_PATTERN.test(prefix)) {
        throw new Error(
          `@zodapp/i18n-messages/comment: the prefix "${prefix}" in "dictionaries" must be identifiers joined and ended by dots (e.g. "myapp.").`,
        );
      }
    }
    // 長い前方一致を先に試す
    const namespaces = Object.entries(options.dictionaries ?? {})
      .map(([prefix, file]) => ({ prefix, file: path.resolve(cwd, file) }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
    if (namespaces.length === 0) return {};

    const sourceCode = context.sourceCode;
    /** キーのすぐ後ろにある目印付きのコメント */
    const owned = new Set();

    /** @param {any} node */
    const check = (node) => {
      const value = stringValueOf(node);
      if (value === undefined) return;
      const namespace = namespaces.find(
        ({ prefix }) =>
          value.startsWith(prefix) &&
          REST_PATTERN.test(value.slice(prefix.length)),
      );
      if (!namespace || isIgnoredPosition(node)) return;

      // msgKey の書式（key?a=1）なら、キーは ? の前
      const key = value.split("?")[0] ?? "";
      const entries = loadDictionary(namespace.file, referenceLocale);
      const text = entries.get(key);
      if (text === undefined) {
        context.report({
          node,
          messageId: "unknownKey",
          data: {
            key,
            file: path.relative(cwd, namespace.file) || namespace.file,
          },
        });
        return;
      }

      const commentText =
        text === "" ? MARKER : `${MARKER} ${escapeCommentText(text)}`;
      const expected = `/* ${commentText} */`;
      const data = { text: commentText };

      // JSX の属性の値には後ろにコメントを置けないので、{} で包む。
      // JSX の文字列は実体参照（&amp;）を解釈するので、ソースではなく値を JS の文字列にする
      if (node.parent?.type === "JSXAttribute") {
        context.report({
          node,
          messageId: "missing",
          data,
          fix: (fixer) =>
            fixer.replaceText(node, `{${JSON.stringify(value)} ${expected}}`),
        });
        return;
      }

      // 目印付きのブロックコメントだけを扱う。普通のコメント・行コメントには触らない
      const marked = sourceCode
        .getCommentsAfter(node)
        .filter((comment) => markedTextOf(comment) !== undefined);
      for (const comment of marked) owned.add(comment);

      const firstMarked = marked[0];
      if (!firstMarked?.range) {
        context.report({
          node,
          messageId: "missing",
          data,
          fix: (fixer) => fixer.insertTextAfter(node, ` ${expected}`),
        });
        return;
      }

      const loc = firstMarked.loc ?? node.loc ?? { line: 1, column: 0 };
      /** @param {import("eslint").Rule.RuleFixer} fixer */
      const replaceFirst = (fixer) =>
        fixer.replaceTextRange(
          /** @type {[number, number]} */ (firstMarked.range),
          expected,
        );

      if (
        marked.length > 1 ||
        marked.some((comment) => comment.value.includes("\n"))
      ) {
        context.report({
          loc,
          messageId: "malformed",
          data,
          fix: (fixer) => [
            replaceFirst(fixer),
            ...marked.slice(1).map((comment) => removeComment(fixer, comment)),
          ],
        });
        return;
      }

      const written = unescapeCommentText(markedTextOf(firstMarked) ?? "");
      if (written === null) {
        context.report({ loc, messageId: "invalidEscape" });
        return;
      }
      if (normalizeForCompare(written) !== normalizeForCompare(text)) {
        context.report({ loc, messageId: "mismatch", data, fix: replaceFirst });
      }
    };

    /**
     * コメントと、その前の空白（同じ行の中）を消す。
     * 後ろに続くトークンと前のトークンがくっつかないよう、後ろが空白・閉じ括弧・区切りでなければ空白 1 つを残す。
     *
     * @param {import("eslint").Rule.RuleFixer} fixer
     * @param {import("eslint").AST.Program["comments"][number]} comment
     */
    const removeComment = (fixer, comment) => {
      const [start, end] = /** @type {[number, number]} */ (comment.range);
      const before = sourceCode.text.slice(0, start);
      const spaces = /[ \t]*$/.exec(before)?.[0].length ?? 0;
      const after = sourceCode.text[end];
      if (after === undefined || /[\s)\]},;:]/.test(after)) {
        return fixer.removeRange([start - spaces, end]);
      }
      return fixer.replaceTextRange([start - spaces, end], " ");
    };

    return {
      Literal: check,
      TemplateLiteral: check,
      "Program:exit"() {
        // キーのすぐ後ろ以外にある目印付きのコメントは、キーを消したあとに残ったもの
        for (const comment of sourceCode.getAllComments()) {
          if (owned.has(comment) || markedTextOf(comment) === undefined) {
            continue;
          }
          context.report({
            loc: comment.loc ?? { line: 1, column: 0 },
            messageId: "orphan",
            fix: (fixer) => removeComment(fixer, comment),
          });
        }
      },
    };
  },
};

export default rule;
