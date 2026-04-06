import { z } from "zod";
import type {
  CollectionConfigBase,
  LooseCollectionConfigBase,
} from "./baseTypes";

/**
 * mutation 関数の型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MutationFn<DataSchema extends z.ZodType<any>> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Partial<z.infer<DataSchema>>;

type SchemaFromCollection<TCollection extends LooseCollectionConfigBase> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TCollection["storeSchema"] extends z.ZodType<any>
    ? TCollection["storeSchema"]
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      z.ZodType<any>;

export type CollectionMutations<
  TCollection extends LooseCollectionConfigBase,
  Mutations extends Record<
    string,
    MutationFn<SchemaFromCollection<TCollection>>
  > = Record<string, never>,
> = {
  readonly collection: TCollection;
  readonly mutations: Mutations;
};

export interface CollectionMutationsBase {
  readonly collection: CollectionConfigBase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly mutations: Record<string, MutationFn<z.ZodType<any>>>;
}

export interface LooseCollectionMutationsBase {
  readonly collection: LooseCollectionConfigBase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly mutations: Record<string, MutationFn<z.ZodType<any>>>;
}

export const createCollectionMutations = <
  const TCollection extends LooseCollectionConfigBase,
  const Mutations extends Record<
    string,
    MutationFn<SchemaFromCollection<TCollection>>
  >,
>(
  collection: TCollection,
  mutations: Mutations,
): CollectionMutations<TCollection, Mutations> => ({
  collection,
  mutations,
});
