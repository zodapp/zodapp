import { useCallback, useMemo } from "react";
import {
  getAccessor,
  type AccessorStoreKey,
} from "@zodapp/zod-firebase-browser";
import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import type { z } from "zod";
import { firestore } from "@repo/firebase";
import { useStoreKey } from "../auth";
import type { ListQuerySpec } from "./listQuerySpec";

function useSpecAccessor<TConfig extends CollectionConfigBase>(
  collection: TConfig,
  storeKey: AccessorStoreKey,
) {
  return useMemo(() => getAccessor(firestore, collection, storeKey), [collection, storeKey]);
}

export function useExportFetchAll<TConfig extends CollectionConfigBase>(
  spec: ListQuerySpec<TConfig>,
): () => Promise<z.infer<TConfig["dataSchema"]>[]> {
  const storeKey = useStoreKey();
  const accessor = useSpecAccessor(spec.collection, storeKey);

  return useCallback(async () => {
    if (spec.collectionIdentity === undefined) {
      return [];
    }

    const rows = await accessor.query(spec.collectionIdentity, spec.query);
    return spec.clientFilter ? rows.filter(spec.clientFilter) : rows;
  }, [accessor, spec.collectionIdentity, spec.query, spec.clientFilter]);
}
