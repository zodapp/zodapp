/**
 * 外部キー解決のための共通型定義
 */

/** ResolverのID（"firestore"など） */
export type ResolverId = string;

/** unsubscribe用の関数 */
export type Unsubscriber = () => void;

/**
 * optionsを受け取るコールバック
 * 型制約(nullなど)はzod、ui仕様(error/loading)はuiコンポーネントで決定する
 */
export type ExternalKeyOptionsHandler = (
  options: { label: string; value: string }[],
) => void;

/**
 * Resolver実行結果
 * subscriptionCacheに委譲するため、以下の振る舞いは自動的に得られる:
 * - 初回subscribe時の即時emit（キャッシュがあれば）
 * - subscription共有とretention管理
 */
export type ExternalKeyResolverResult = {
  subscribe: (callback: ExternalKeyOptionsHandler) => Unsubscriber;
};

/**
 * 外部キー設定の基底型（type込み）
 */
export type BaseExternalKeyConfig<TType extends ResolverId = ResolverId> = {
  type: TType;
};

/**
 * Resolver Entry（配列登録用）
 * typeをResolver側で持つことで、登録キーとconfig.typeの一致を構造的に保証
 */
export type ExternalKeyResolverEntry<
  TType extends ResolverId,
  TConfig = unknown,
> = {
  type: TType;
  resolver: (config: TConfig & { type: TType }) => ExternalKeyResolverResult;
};

/**
 * Resolvers（配列形式）
 * Entryのtype がSoTとなり、config.type との一致を保証
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExternalKeyResolvers = ExternalKeyResolverEntry<any, any>[];

/**
 * 外部キー設定
 * 直接指定またはrender時に解決する関数形式をサポート
 */
export type ExternalKeyConfig<
  TConfig extends BaseExternalKeyConfig = BaseExternalKeyConfig,
> = TConfig | (() => TConfig);

// === 案3: declare module 用の型拡張ポイント ===

/**
 * 外部キー設定のレジストリ（アプリ側で declare module で拡張）
 *
 * 使用例:
 * declare module "@zodapp/zod-form/externalKey/types" {
 *   interface ExternalKeyConfigRegistry {
 *     config: WebExternalKeyConfig;
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExternalKeyConfigRegistry {}

/**
 * 登録済みの外部キー設定型
 * - ExternalKeyConfigRegistry に config が登録されていればその型を使用
 * - 未登録なら BaseExternalKeyConfig にフォールバック
 */
export type RegisteredExternalKeyConfig = ExternalKeyConfigRegistry extends {
  config: infer T;
}
  ? T
  : BaseExternalKeyConfig;
