import type { CollectionConfigBase, QueryOptions } from "@zodapp/zod-firebase";
import type { UseListOptions } from "@zodapp/zod-firebase-browser";

export type ListQuerySpec<TConfig extends CollectionConfigBase> = Pick<
  Omit<UseListOptions<TConfig>, "storeKey">,
  "collection" | "collectionIdentity" | "query" | "clientFilter"
>;

export type GrowingListQuerySpec<TConfig extends CollectionConfigBase> =
  ListQuerySpec<TConfig> & {
    streamQuery?: QueryOptions;
  };
