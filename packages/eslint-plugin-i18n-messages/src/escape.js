// @ts-check

/**
 * コメントに書く文言のエスケープ。
 * `\` → `\\`、改行 → `\n`、`*\/` → `*\/`（`*` と `/` の間に `\`）。
 *
 * @param {string} text
 * @returns {string}
 */
export const escapeCommentText = (text) =>
  text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/\*\//g, "*\\/");

/**
 * {@link escapeCommentText} を戻す。知らないエスケープ（`\x`）があれば null を返す。
 *
 * @param {string} text
 * @returns {string | null}
 */
export const unescapeCommentText = (text) => {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "\\") {
      result += ch;
      continue;
    }
    const next = text[i + 1];
    if (next === "\\") result += "\\";
    else if (next === "n") result += "\n";
    else if (next === "/" && text[i - 1] === "*") result += "/";
    else return null;
    i++;
  }
  return result;
};

/**
 * 突き合わせのための正規化。空白の連続を 1 つにまとめ、前後を取り除く。
 *
 * @param {string} text
 * @returns {string}
 */
export const normalizeForCompare = (text) => text.replace(/\s+/g, " ").trim();
