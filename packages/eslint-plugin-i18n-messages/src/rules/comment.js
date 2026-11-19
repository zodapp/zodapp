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
 * @property {string[]} [callees] 対象の関数名（既定 `["msg", "msgKey"]`）
 * @property {string} [referenceLocale] 基準の言語。辞書のファイルの中で、この名前の変数を辞書とする（既定 `"ja"`）
 * @property {Record<string, string>} [dictionaries] キーの名前空間（前方一致）と、基準の言語の辞書のファイル。相対パスは ESLint の cwd から
 */

const DEFAULT_CALLEES = ["msg", "msgKey"];

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
          callees: { type: "array", items: { type: "string" } },
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
    },
  },

  create(context) {
    /** @type {CommentRuleOptions} */
    const options = context.options[0] ?? {};
    const callees = new Set(options.callees ?? DEFAULT_CALLEES);
    const referenceLocale = options.referenceLocale ?? "ja";
    const cwd = context.cwd;
    // 長い前方一致を先に試す
    const namespaces = Object.entries(options.dictionaries ?? {})
      .map(([prefix, file]) => ({ prefix, file: path.resolve(cwd, file) }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
    if (namespaces.length === 0) return {};

    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        if (
          node.callee.type !== "Identifier" ||
          !callees.has(node.callee.name)
        ) {
          return;
        }
        const first = node.arguments[0];
        if (
          !first ||
          first.type !== "Literal" ||
          typeof first.value !== "string"
        ) {
          return;
        }
        // msgKey の書式（key?a=1）なら、キーは ? の前
        const key = first.value.split("?")[0] ?? "";
        const namespace = namespaces.find(({ prefix }) =>
          key.startsWith(prefix),
        );
        if (!namespace) return;

        const entries = loadDictionary(namespace.file, referenceLocale);
        const text = entries.get(key);
        if (text === undefined) {
          context.report({
            node: first,
            messageId: "unknownKey",
            data: {
              key,
              file: path.relative(cwd, namespace.file) || namespace.file,
            },
          });
          return;
        }

        const expected = `/* ${escapeCommentText(text)} */`;
        const data = { text: escapeCommentText(text) };
        const comments = sourceCode.getCommentsAfter(first);

        if (comments.length === 0) {
          context.report({
            node: first,
            messageId: "missing",
            data,
            fix: (fixer) => fixer.insertTextAfter(first, ` ${expected}`),
          });
          return;
        }

        const firstComment = comments[0];
        const lastComment = comments[comments.length - 1];
        if (!firstComment?.range || !lastComment?.range) return;
        const range = /** @type {[number, number]} */ ([
          firstComment.range[0],
          lastComment.range[1],
        ]);
        const replace = /** @param {import("eslint").Rule.RuleFixer} fixer */ (
          fixer,
        ) => fixer.replaceTextRange(range, expected);

        if (
          comments.length > 1 ||
          firstComment.type !== "Block" ||
          firstComment.value.includes("\n")
        ) {
          context.report({
            loc: firstComment.loc ??
              first.loc ??
              node.loc ?? { line: 1, column: 0 },
            messageId: "malformed",
            data,
            fix: replace,
          });
          return;
        }

        const written = unescapeCommentText(firstComment.value);
        if (written === null) {
          context.report({
            loc: firstComment.loc ?? node.loc ?? { line: 1, column: 0 },
            messageId: "invalidEscape",
          });
          return;
        }
        if (normalizeForCompare(written) !== normalizeForCompare(text)) {
          context.report({
            loc: firstComment.loc ?? node.loc ?? { line: 1, column: 0 },
            messageId: "mismatch",
            data,
            fix: replace,
          });
        }
      },
    };
  },
};

export default rule;
