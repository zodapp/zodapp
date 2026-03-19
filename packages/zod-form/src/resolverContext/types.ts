/**
 * Resolver Context の共通型定義
 *
 * contextId ごとに異なる runtime context（teamId, workspaceId 等）を
 * 型安全に扱うための拡張ポイントと導出型を提供する。
 */

/**
 * Resolver Context のレジストリ（アプリ側で declare module で拡張）
 *
 * 使用例:
 * declare module "@zodapp/zod-form/resolverContext/types" {
 *   interface ResolverContextRegistry {
 *     map: {
 *       team: { teamId: string };
 *       workspace: { workspaceId: string };
 *     };
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ResolverContextRegistry {}

/**
 * 登録済みの Resolver Context Map
 * - ResolverContextRegistry に map が登録されていればその型を使用
 * - 未登録なら Record<string, Record<string, unknown>> にフォールバック
 */
export type RegisteredResolverContextMap =
  ResolverContextRegistry extends { map: infer T }
    ? T
    : Record<string, Record<string, unknown>>;

/**
 * 登録済みの contextId
 */
export type RegisteredResolverContextId =
  keyof RegisteredResolverContextMap & string;

/**
 * resolver に渡す runtime context の型
 * 複数の contextId に対応するため Partial で受ける
 */
export type RegisteredResolverContext =
  Partial<RegisteredResolverContextMap>;
