import type { CollectionConfigBase } from "@zodapp/zod-firebase";

type Key = unknown[];

// 一つのフィールドの複数の型は混在しないという仮定でパフォーマンス重視で実装
const compareFn = (a: unknown, b: unknown) => {
  // null は先頭（= smaller）
  const aNull = a === null;
  const bNull = b === null;
  if (aNull || bNull) return aNull === bNull ? 0 : aNull ? -1 : 1;

  // missing は基本来ない前提だが比較関数の型ガードとして(TypeScript用)
  if (a === undefined || b === undefined) {
    if (a === b) return 0;
    return a === undefined ? 1 : -1;
  }

  if (a === b) return 0;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

export type SortTools<T> = {
  getKeys: (item: T) => Key;
  sortFn: (a: Key, b: Key) => number;
};

export const createSortTools = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  config: CollectionConfigBase,
  orderBy: { field: string; direction: "asc" | "desc" }[],
): SortTools<T> => {
  const orderByWithTieBreak = orderBy.some((o) => o.field === "__name__")
    ? orderBy
    : [...orderBy, { field: "__name__", direction: "asc" as const }];

  const keyFields = orderByWithTieBreak.map((o) =>
    o.field === "__name__" ? config.documentKey : o.field,
  );

  const comparators = orderByWithTieBreak.map((o, index) => {
    const direction = o.direction === "asc" ? 1 : -1;
    return (a: Key, b: Key) => {
      return compareFn(a[index], b[index]) * direction;
    };
  });

  const getKeys = (item: T): Key => {
    return keyFields.map((field) => {
      return item[field];
    });
  };

  const sortFn = (a: Key, b: Key) => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  };

  return { getKeys, sortFn };
};
