import {
  onceListStore,
  type ListStore,
  type QueryFunction,
} from "@zodapp/zod-dynamodb-client";
import type {
  ExternalKeyOptionsHandler,
  ExternalKeyResolverEntry,
} from "@zodapp/zod-form/externalKey/types";
import {
  getRequiredResolverContextSlice,
  type RegisteredResolverContext,
} from "@zodapp/zod-form/resolverContext";
import type {
  DynamoExternalKeyConfigCore,
  ExternalKeyItem,
} from "./types";

/** クエリの関数（`live` があればリアルタイムで購読する） */
type AnyQueryFunction = QueryFunction<unknown, ExternalKeyItem> & {
  live?: (params: unknown) => ListStore<ExternalKeyItem>;
};

/** ブラウザの API（`createClient` の戻り値）。グループと操作の名前で関数を引く */
export type QueryApi = object;

/** 「グループ名.操作の名前」から、ブラウザの API のクエリの関数を引く */
export const resolveQuery = (api: QueryApi, name: string): AnyQueryFunction => {
  const [group, op, ...rest] = name.split(".");
  const fn =
    rest.length === 0 && group && op
      ? (api as Record<string, Record<string, unknown> | undefined>)[group]?.[op]
      : undefined;
  if (typeof fn !== "function") {
    throw new Error(`unknown query: "${name}" (expected "group.operation")`);
  }
  return fn as AnyQueryFunction;
};

/** 1 件の表示 */
export const labelOf = (
  config: Pick<DynamoExternalKeyConfigCore, "valueField" | "labelField" | "labelFormatter">,
  item: ExternalKeyItem,
): string => {
  if (config.labelFormatter) return config.labelFormatter(item);
  const label = config.labelField ? item[config.labelField] : undefined;
  return String(label ?? item[config.valueField] ?? "");
};

/** Resolver が受け取る設定（resolverContext の型はアプリが決めるので、ここでは問わない） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolverConfig = DynamoExternalKeyConfigCore<string, any>;

export type DynamoExternalKeyResolverOptions<TType extends string> = {
  /** 設定の `type`。既定は `"dynamodb"` */
  type?: TType;
};

/**
 * 外部キーの選択肢の Resolver。登録簿のクエリを読み、`live` があれば購読し続ける
 * （メンバーが増えれば選択肢も増える）。`live` がなければ、全体を 1 回だけ読む。
 *
 * ```ts
 * const resolvers = [createDynamoExternalKeyResolver(api)];
 * ```
 */
export const createDynamoExternalKeyResolver = <TType extends string = "dynamodb">(
  api: QueryApi,
  options: DynamoExternalKeyResolverOptions<TType> = {},
): ExternalKeyResolverEntry<TType, ResolverConfig> => ({
  type: (options.type ?? "dynamodb") as TType,
  resolver: (config, resolverContext: RegisteredResolverContext) => {
    const core = config;
    const context = getRequiredResolverContextSlice<unknown>(
      resolverContext,
      core.contextId,
    );
    const params = core.params(context);
    return {
      subscribe: (callback: ExternalKeyOptionsHandler) => {
        const fn = resolveQuery(api, core.query);
        const store = fn.live ? fn.live(params) : onceListStore(fn, params);
        const emit = () => {
          const state = store.getState();
          if (state.status !== "ready") return;
          const items = core.filter ? state.items.filter(core.filter) : state.items;
          callback(
            items.map((item) => ({
              label: labelOf(core, item),
              value: String(item[core.valueField]),
            })),
          );
        };
        const off = store.subscribe(emit);
        emit();
        return () => {
          off();
          store.close();
        };
      },
    };
  },
});
