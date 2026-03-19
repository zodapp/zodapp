/**
 * Firebase Storage ファイルResolver
 */

import type {
  FileResolverEntry,
  FileResolverResult,
} from "@zodapp/zod-form/file/types";
import type {
  FirebaseStorageFileConfig,
  FirebaseStorageFileConfigCore,
} from "./types";
import firebase from "firebase/compat/app";
import { v4 as uuidv4 } from "uuid";

type Storage = firebase.storage.Storage;

/**
 * Firebase Storage用のファイルResolverEntryを生成する
 *
 * resolverContext は ZodFormContextProvider 経由で resolver(config, resolverContext) の
 * 第2引数として渡される。保存先は fileConfig.getLocation(resolverContext) で決定される。
 *
 * @param type - ResolverのID（デフォルト: "firebaseStorage"）
 * @param storage - Firebase Storageインスタンス
 */
export function createFirebaseStorageResolver<
  TType extends string = "firebaseStorage",
>({
  type = "firebaseStorage" as TType,
  storage,
}: {
  type?: TType;
  storage: Storage;
}): FileResolverEntry<TType, FirebaseStorageFileConfigCore> {
  return {
    type,
    resolver: (
      config: FirebaseStorageFileConfig<TType>,
      resolverContext: unknown,
    ): FileResolverResult => {
      const location = config.getLocation(
        resolverContext as Record<string, unknown>,
      );

      return {
        upload: async (file: File): Promise<{ url: string }> => {
          const bucket =
            location.bucket ??
            (storage.app.options as { storageBucket?: string }).storageBucket;
          const fileName = `${uuidv4()}`;
          const fullPath = `${location.parentPath}/${fileName}`;

          const ref = storage.refFromURL(`gs://${bucket}/${fullPath}`);
          await ref.put(file);

          const storedUrl = `gs://${bucket}/${fullPath}?mimeType=${encodeURIComponent(file.type)}`;
          return { url: storedUrl };
        },

        getDownloadUrl: async (storedUrl: string): Promise<{ url: string }> => {
          const url = new URL(storedUrl);
          const gsPath = `gs://${url.host}${url.pathname}`;
          const ref = storage.refFromURL(gsPath);
          const downloadUrl = await ref.getDownloadURL();
          return { url: downloadUrl };
        },

        delete: async (storedUrl: string): Promise<void> => {
          const url = new URL(storedUrl);
          const gsPath = `gs://${url.host}${url.pathname}`;
          const ref = storage.refFromURL(gsPath);
          await ref.delete();
        },
      };
    },
  };
}
