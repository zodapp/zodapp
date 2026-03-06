import { useState, useEffect, useMemo } from "react";
import { stableStringify } from "@zodapp/caching-utilities";
import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import type { z } from "zod";
import type firebase from "firebase/compat/app";
import { getAccessor } from "../firestore";

type Firestore = firebase.firestore.Firestore;

/**
 * `useDoc` が返す単一ドキュメント状態。
 */
export type DocState<T> = {
  item?: T;
  isLoading: boolean;
};

/**
 * `useDoc` のオプション。
 *
 * - `collection`: 対象コレクション定義
 * - `documentIdentity`: 対象ドキュメントの識別パラメータ。
 *   `undefined` を渡すと監視を行わず `{ item: undefined, isLoading: false }` を返す。
 */
export type UseDocOptions<TConfig extends CollectionConfigBase> = {
  collection: TConfig;
  documentIdentity?: z.infer<TConfig["documentIdentitySchema"]>;
};

/**
 * firestore インスタンスをバインドした useDoc フックを作成するファクトリ関数
 */
export function createUseDoc(firestore: Firestore) {
  return function useDoc<TConfig extends CollectionConfigBase>(
    options: UseDocOptions<TConfig>,
  ): DocState<z.infer<TConfig["dataSchema"]>> {
    type ItemType = z.infer<TConfig["dataSchema"]>;

    const { collection, documentIdentity } = options;
    const [item, setItem] = useState<ItemType | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    const documentIdentityKey = useMemo(
      () => stableStringify(documentIdentity),
      [documentIdentity],
    );

    useEffect(() => {
      if (documentIdentity === undefined) {
        setItem(undefined);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const accessor = getAccessor(firestore, collection);
      const unsub = accessor.docSync(documentIdentity, (doc) => {
        setItem(doc ?? undefined);
        setIsLoading(false);
      });

      return () => {
        unsub();
      };
    }, [documentIdentityKey, collection]);

    return { item, isLoading };
  };
}
