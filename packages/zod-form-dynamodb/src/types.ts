/**
 * 外部キー（担当者など）の選択肢を、登録簿の名前付きクエリから引く設定。
 *
 * 設定はブラウザとサーバーで共有する定義（Table 定義や zf の Schema）に置くので、
 * ブラウザの API には依存させない。登録簿のクエリの名前と、パラメーターを作る関数だけを持つ。
 * Resolver（`createDynamoExternalKeyResolver(api)`）が、名前からブラウザの API の関数を引く。
 */
import type { BaseExternalKeyConfig } from "@zodapp/zod-form/externalKey/types";

/** 選択肢の 1 件（クエリの結果の Item） */
export type ExternalKeyItem = Record<string, unknown>;

/** 実装固有のフィールド（type を除く） */
export type DynamoExternalKeyConfigCore<
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = {
  /** resolverContext のどの部分を使うか */
  contextId: TContextId;
  /** 登録簿のクエリの名前（「グループ名.操作の名前」。例：`"members.byWorkspace"`） */
  query: string;
  /** クエリのパラメーターを、resolverContext から作る */
  params: (context: TContext) => Record<string, unknown>;
  /** 値にするフィールド */
  valueField: string;
  /** 表示するフィールド。省略すると `valueField` の値を出す */
  labelField?: string;
  /** 表示を作る関数。`labelField` より優先する */
  labelFormatter?: (item: ExternalKeyItem) => string;
  /** 読み込んだ一覧の絞り込み（DynamoDB のクエリでは表せない条件） */
  filter?: (item: ExternalKeyItem) => boolean;
};

/**
 * 外部キーの設定（type 込み）。アプリは `declare module` で登録して使う。
 *
 * ```ts
 * declare module "@zodapp/zod-form/externalKey/types" {
 *   interface ExternalKeyConfigRegistry {
 *     config: DynamoExternalKeyConfig<"dynamodb", "workspace", { workspaceId: string }>;
 *   }
 * }
 * ```
 */
export type DynamoExternalKeyConfig<
  TType extends string = "dynamodb",
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = BaseExternalKeyConfig<TType> &
  DynamoExternalKeyConfigCore<TContextId, TContext>;
