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

      const expected = `/* ${escapeCommentText(text)} */`;
      const data = { text: escapeCommentText(text) };

      // JSX の属性の値には後ろにコメントを置けないので、{} で包む
      if (node.parent?.type === "JSXAttribute") {
        context.report({
          node,
          messageId: "missing",
          data,
          fix: (fixer) =>
            fixer.replaceText(
              node,
              `{${sourceCode.getText(node)} ${expected}}`,
            ),
        });
        return;
      }

      const comments = sourceCode.getCommentsAfter(node);

      if (comments.length === 0) {
        context.report({
          node,
          messageId: "missing",
          data,
          fix: (fixer) => fixer.insertTextAfter(node, ` ${expected}`),
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
      const loc = firstComment.loc ?? node.loc ?? { line: 1, column: 0 };

      if (
        comments.length > 1 ||
        firstComment.type !== "Block" ||
        firstComment.value.includes("\n")
      ) {
        context.report({ loc, messageId: "malformed", data, fix: replace });
        return;
      }

      const written = unescapeCommentText(firstComment.value);
      if (written === null) {
        context.report({ loc, messageId: "invalidEscape" });
        return;
      }
      if (normalizeForCompare(written) !== normalizeForCompare(text)) {
        context.report({ loc, messageId: "mismatch", data, fix: replace });
      }
    };

    return { Literal: check, TemplateLiteral: check };
  },
};

export default rule;
