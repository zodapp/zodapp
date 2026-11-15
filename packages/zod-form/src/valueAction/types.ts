/**
 * 値ごとの操作（選んだ値をリンクで開くなど）の型定義。
 * string / enum / externalKey の meta の `valueAction` で使う。
 */

import type {
  RegisteredResolverContextId,
} from "../resolverContext/types";

/**
 * 値ごとの操作の基底パラメータ。
 * core は router/link 実装を知らないため、広い object 型に留める。
 */
export type BaseValueActionParams = Record<string, unknown>;

/**
 * 値ごとの操作の設定の基底型。
 * contextId は resolverContext のどの部分を使うかの識別子。
 * getActionParams は値と context を受けて操作のパラメータを返す。
 */
export type BaseValueActionConfig<
  TContext = unknown,
  TParams extends BaseValueActionParams = BaseValueActionParams,
> = {
  contextId?: RegisteredResolverContextId;
  getActionParams: (input: {
    value: string;
    context: TContext | undefined;
  }) => TParams;
};

/**
 * 値ごとの操作のレジストリ（アプリ側で declare module で拡張）
 *
 * 使用例:
 * declare module "@zodapp/zod-form/valueAction/types" {
 *   interface ValueActionRegistry {
 *     actionConfig: WebValueActionConfig;
 *     actionParams: WebValueActionParams;
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ValueActionRegistry {}

/**
 * 登録済みの操作の設定型
 * - ValueActionRegistry に actionConfig が登録されていればその型を使用
 * - 未登録なら BaseValueActionConfig にフォールバック
 */
export type RegisteredValueActionConfig = ValueActionRegistry extends {
  actionConfig: infer T;
}
  ? T
  : BaseValueActionConfig;

/**
 * 登録済みの操作のパラメータ型
 * - ValueActionRegistry に actionParams が登録されていればその型を使用
 * - 未登録なら BaseValueActionParams にフォールバック
 */
export type RegisteredValueActionParams = ValueActionRegistry extends {
  actionParams: infer T;
}
  ? T
  : BaseValueActionParams;
