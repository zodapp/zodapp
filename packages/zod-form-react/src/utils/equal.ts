/** 値を中まで比べる（Date は時刻、Set・Map は中身で比べる）。フォームの値の比較に使う */
export const isEqualValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  // Set・Map はキーの無い object に見えるので、中身で比べる（Set は順序を見ない。要素は同じ値か Object.is）
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) {
      return false;
    }
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) {
      return false;
    }
    for (const [key, value] of a) {
      if (!b.has(key) || !isEqualValue(value, b.get(key))) return false;
    }
    return true;
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    isEqualValue(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
};
