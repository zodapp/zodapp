import type { z } from "zod";
import type { AnyTableConfig, IfUnchangedMode, ItemOf } from "./table";
import type { Bivariant, NumericField, PatchOf } from "./types";
import type { WhereOf } from "./where";

export type MutationDef<
  TT extends AnyTableConfig = AnyTableConfig,
  TParams extends z.ZodType = z.ZodType,
  TContext = any,
> = {
  readonly kind: "mutation";
  readonly table: TT;
  readonly name: string;
  readonly params: TParams;
  /** パラメーターから部分更新を作る */
  readonly patch:
    | Bivariant<
        (params: z.output<TParams>, ctx: TContext) => PatchOf<ItemOf<TT>>
      >
    | undefined;
  /** 数値のフィールドへの原子的な加算（§6.4） */
  readonly add:
    | Bivariant<
        (
          params: z.output<TParams>,
          ctx: TContext,
        ) => { [K in NumericField<ItemOf<TT>>]?: number }
      >
    | undefined;
  /** 書き込みの条件。書き込みと同じリクエストでDynamoDBが評価する */
  readonly where:
    | Bivariant<
        (params: z.output<TParams>, ctx: TContext) => WhereOf<ItemOf<TT>>
      >
    | undefined;
  /** `ifUnchanged` のトークンを必須にするか。指定しなければTable定義の設定に従う */
  readonly ifUnchanged: IfUnchangedMode | undefined;
};
