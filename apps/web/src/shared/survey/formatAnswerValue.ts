/**
 * 回答（answers）の値を表示用文字列へ整形する。
 *
 * answers は質問の種類ごとに型が異なる（string / number / boolean / Date）ため
 * `z.unknown()` で保持し、表示側でこの関数を通す。
 * `zf.derived` の compute として登録することで、テーブルセルでもそのまま使える
 * （`ComputedValue` は string を含む union なので戻り値をそのまま渡せる）。
 */
export const formatAnswerValue = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (value instanceof Date) return value.toLocaleDateString("ja-JP");
  if (Array.isArray(value)) {
    return value.map((item) => formatAnswerValue(item)).join(", ");
  }
  // Firestore Timestamp のような { toDate() } を持つ値
  if (
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("ja-JP");
  }
  return JSON.stringify(value);
};
