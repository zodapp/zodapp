/**
 * Firestore アクセサを生成する関数を再 export します（Node / firebase-admin 向け）。
 */
export { getAccessor, getMutationsAccessor } from "./firestore";

/**
 * Firestore クエリビルダーを生成する関数を再 export します（Node / firebase-admin 向け）。
 */
export { queryBuilder } from "./firestore";

export type { AccessorLevelQueryOptions } from "./firestore";
