import { firestore } from "@repo/firebase";
import {
  createUseCollectionGroupList,
  createUseDoc,
  createUseGrowingList,
  createUseList,
  type DocState,
  type UseCollectionGroupListOptions,
  type UseCollectionGroupListResult,
  type UseDocOptions,
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
const useDocInternal = createUseDoc(firestore);
const useCollectionGroupListInternal = createUseCollectionGroupList(firestore);

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

// 単一ドキュメントの購読。詳細画面で useEffect + accessor.docSync を
// 手書きする代わりに使う。
export function useDoc<TConfig extends CollectionConfigBase>(
  options: Omit<UseDocOptions<TConfig>, "storeKey">,
): DocState<z.infer<TConfig["dataSchema"]>> {
  const storeKey = useStoreKey();
  return useDocInternal({ ...options, storeKey });
}

// collectionGroup クエリ（パス階層を横断してサブコレクションを検索）。
// 「ユーザーが所属する全ワークスペースの members を横断検索」等に使う。
export function useCollectionGroupList<TConfig extends CollectionConfigBase>(
  options: Omit<UseCollectionGroupListOptions<TConfig>, "storeKey">,
): UseCollectionGroupListResult<z.infer<TConfig["dataSchema"]>> {
  const storeKey = useStoreKey();
  return useCollectionGroupListInternal({ ...options, storeKey });
}
