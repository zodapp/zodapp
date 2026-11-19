/**
 * フィールドパス（`a.b[0].c`）を扱う小さな関数群。
 */

export type PathSegment = string | number;

/** `a.b[0].c` を `["a", "b", 0, "c"]` に分ける。空文字はルート（`[]`） */
export const parseFieldPath = (fieldPath: string): PathSegment[] =>
  fieldPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));

/** 分けたパスをフィールドパスの文字列に戻す */
export const joinFieldPath = (segments: readonly PropertyKey[]): string =>
  segments.reduce<string>((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    const key = String(segment);
    return acc === "" ? key : `${acc}.${key}`;
  }, "");

/** 値の中の、パスが指す位置の値を返す。途中が無ければ undefined */
export const getValueAt = (
  value: unknown,
  segments: readonly PathSegment[],
): unknown =>
  segments.reduce<unknown>(
    (acc, segment) =>
      acc === null || acc === undefined
        ? undefined
        : (acc as Record<PropertyKey, unknown>)[segment],
    value,
  );

/** issue の path（PropertyKey か { key } の配列）を PathSegment の配列にそろえる */
export const normalizeIssuePath = (path: readonly unknown[]): PathSegment[] =>
  path.flatMap((segment) => {
    if (typeof segment === "string" || typeof segment === "number") {
      return [segment];
    }
    if (segment && typeof segment === "object" && "key" in segment) {
      const key = (segment as { key?: unknown }).key;
      return typeof key === "string" || typeof key === "number" ? [key] : [];
    }
    return [];
  });

/** path が prefix で始まるか（数値と文字列の添字は同じとみなす） */
export const pathStartsWith = (
  path: readonly PathSegment[],
  prefix: readonly PathSegment[],
): boolean =>
  prefix.length <= path.length &&
  prefix.every((segment, index) => String(path[index]) === String(segment));

/**
 * フィールドパスの名前に使えないキーか。`.`・`[`・`]` を含むキーは、パスにすると別の場所を指し、
 * 空文字のキーは親を指してしまう。フォームの欄としては扱わない
 */
export const isUnsafeFieldKey = (key: string): boolean =>
  key === "" || /[.[\]]/.test(key);
