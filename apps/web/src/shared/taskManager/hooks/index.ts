import { firestore } from "@repo/firebase";
import {
  createUseGrowingList,
  createUseList,
  type UseGrowingListOptions,
  type UseGrowingListResult,
  type UseListOptions,
  type UseListResult,
} from "@zodapp/zod-firebase-browser";
import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import type { z } from "zod";
import { useStoreKey } from "../../auth";

const useGrowingListInternal = createUseGrowingList(firestore);
const useListInternal = createUseList(firestore);

export function useGrowingList<TConfig extends CollectionConfigBase>(
  options: Omit<UseGrowingListOptions<TConfig>, "storeKey">,
): UseGrowingListResult<z.infer<TConfig["dataSchema"]>> {
  const storeKey = useStoreKey();
  return useGrowingListInternal({ ...options, storeKey });
}

export function useList<TConfig extends CollectionConfigBase>(
  options: Omit<UseListOptions<TConfig>, "storeKey">,
): UseListResult<z.infer<TConfig["dataSchema"]>> {
  const storeKey = useStoreKey();
  return useListInternal({ ...options, storeKey });
}
