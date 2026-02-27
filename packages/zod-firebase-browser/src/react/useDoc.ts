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
 * - `collection` / `documentIdentity`: 対象ドキュメント（documentIdentitySchema）
 */
export type UseDocOptions<TConfig extends CollectionConfigBase> = {
  collection: TConfig;
  documentIdentity: z.infer<TConfig["documentIdentitySchema"]>;
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

    // documentIdentityの依存値をメモ化
    const documentIdentityKey = useMemo(
      () => stableStringify(documentIdentity),
      [documentIdentity],
    );

    useEffect(() => {
      // documentIdentityに空文字が含まれる場合は初期化しない
      const hasEmptyParams = Object.values(documentIdentity).some(
        (value) => value === "" || value === undefined,
      );
      if (hasEmptyParams) {
        setItem(undefined);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const accessor = getAccessor(firestore, collection);
      const unsub = accessor.docSync(documentIdentity, (doc) => {
        setItem(doc);
        setIsLoading(false);
      });

      return () => {
        unsub();
      };
    }, [documentIdentityKey, collection]);

    return { item, isLoading };
  };
}
