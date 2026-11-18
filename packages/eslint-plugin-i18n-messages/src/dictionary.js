// @ts-check
import fs from "node:fs";
import { parse } from "@typescript-eslint/typescript-estree";

/**
 * @typedef {import("@typescript-eslint/typescript-estree").TSESTree.Node} Node
 * @typedef {import("@typescript-eslint/typescript-estree").TSESTree.ObjectExpression} ObjectExpression
 */

/**
 * 式から包み（`satisfies`・`as`・`defineMessages(...)`・括弧）を外して、オブジェクトリテラルを探す。
 *
 * @param {Node | null | undefined} node
 * @returns {ObjectExpression | null}
 */
const unwrapObject = (node) => {
  let current = node;
  while (current) {
    switch (current.type) {
      case "ObjectExpression":
        return current;
      case "TSSatisfiesExpression":
      case "TSAsExpression":
      case "TSTypeAssertion":
      case "TSNonNullExpression":
        current = current.expression;
        break;
      case "CallExpression":
        current = current.arguments[0];
        break;
      default:
        return null;
    }
  }
  return null;
};

/**
 * 項目の値のソースから、コメントに書く文言を作る。辞書は実行しない。
 *
 * - 文字列リテラル → その値
 * - 式を持たないテンプレートリテラル → その値
 * - 本体がテンプレートリテラルか文字列リテラルだけの関数 → テンプレートの中身・文字列の値
 * - それ以外 → 本体（関数でなければ値）のソースそのまま
 *
 * @param {Node} value
 * @param {string} source
 * @returns {string}
 */
export const messageTextOf = (value, source) => {
  /** @param {Node} node */
  const textOf = (node) => {
    if (node.type === "Literal" && typeof node.value === "string") {
      return node.value;
    }
    if (node.type === "TemplateLiteral") {
      // テンプレートの中身（`${count} 件` のように ${} も含めて）をそのまま
      return source.slice(node.range[0] + 1, node.range[1] - 1);
    }
    return source.slice(node.range[0], node.range[1]);
  };
  if (
    value.type === "ArrowFunctionExpression" ||
    value.type === "FunctionExpression"
  ) {
    const body = value.body;
    if (body.type === "BlockStatement") {
      // return 1 つだけの本体なら、その式を見る
      const only = body.body.length === 1 ? body.body[0] : undefined;
      if (only?.type === "ReturnStatement" && only.argument) {
        return textOf(only.argument);
      }
    }
    return textOf(body);
  }
  return textOf(value);
};

/**
 * 辞書のファイルを読み、キーと文言の組を返す。
 * `referenceLocale` と同じ名前の変数（`export const ja = { … }`）があればそれを、
 * 無ければ最初に見つかったオブジェクトリテラル（`defineMessages({ … })` など）を辞書とする。
 *
 * @param {string} source
 * @param {string} filePath
 * @param {string} [variableName]
 * @returns {Map<string, string>}
 */
export const parseDictionary = (source, filePath, variableName) => {
  const ast = parse(source, {
    range: true,
    loc: false,
    jsx: /\.[jt]sx$/.test(filePath),
  });
  /** @type {{ name: string, object: ObjectExpression }[]} */
  const candidates = [];
  for (const statement of ast.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const declarator of declaration.declarations) {
      const object = unwrapObject(declarator.init);
      if (!object || declarator.id.type !== "Identifier") continue;
      candidates.push({ name: declarator.id.name, object });
    }
  }
  const chosen =
    candidates.find((candidate) => candidate.name === variableName) ??
    candidates[0];
  /** @type {Map<string, string>} */
  const entries = new Map();
  if (!chosen) return entries;
  for (const property of chosen.object.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const key =
      property.key.type === "Literal"
        ? String(property.key.value)
        : property.key.type === "Identifier"
          ? property.key.name
          : undefined;
    if (key === undefined) continue;
    entries.set(
      key,
      messageTextOf(/** @type {Node} */ (property.value), source),
    );
  }
  return entries;
};

/** @type {Map<string, { mtimeMs: number, entries: Map<string, string> }>} */
const cache = new Map();

/**
 * 辞書を読む。構文木はモジュールのスコープでキャッシュし、mtime が変わっていれば読み直す
 * （エディタの ESLint サーバーのように長く動くプロセスのため）。
 *
 * @param {string} filePath 絶対パス
 * @param {string} [variableName]
 * @returns {Map<string, string>}
 */
export const loadDictionary = (filePath, variableName) => {
  const { mtimeMs } = fs.statSync(filePath);
  const cacheKey = `${filePath}\0${variableName ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.mtimeMs === mtimeMs) return cached.entries;
  const entries = parseDictionary(
    fs.readFileSync(filePath, "utf8"),
    filePath,
    variableName,
  );
  cache.set(cacheKey, { mtimeMs, entries });
  return entries;
};
