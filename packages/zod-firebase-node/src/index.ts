/**
 * Firestore アクセサを生成する関数を再 export します（Node / firebase-admin 向け）。
 */
export { getAccessor, queryBuilder } from "./firestore/collection";
export type { AccessorLevelQueryOptions } from "./firestore/collection";
export { getMutationsAccessor } from "./firestore/mutation";

