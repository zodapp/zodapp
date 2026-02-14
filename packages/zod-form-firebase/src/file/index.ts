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
  FirebaseStorageLocations,
} from "./types";
import firebase from "firebase/compat/app";
import { v4 as uuidv4 } from "uuid";

type Storage = firebase.storage.Storage;

/**
 * Firebase Storage用のファイルResolverEntryを生成する
 *
 * @param type - ResolverのID（デフォルト: "firebaseStorage"）
 * @param storage - Firebase Storageインスタンス
 * @param locations - ロケーション群（storageLocationIdをキーとする）
 */
export function createFirebaseStorageResolver<
  TType extends string = "firebaseStorage",
>({
  type = "firebaseStorage" as TType,
  storage,
  locations,
}: {
  type?: TType;
  storage: Storage;
  locations: FirebaseStorageLocations;
}): FileResolverEntry<TType, FirebaseStorageFileConfigCore> {
  return {
    type,
    resolver: (config: FirebaseStorageFileConfig<TType>): FileResolverResult => {
      const location = locations[config.storageLocationId];

      if (!location) {
        throw new Error(
          `storageLocationId "${config.storageLocationId}" not found in locations`,
        );
      }

      return {
        upload: async (file: File): Promise<{ url: string }> => {
          const bucket =
            location.bucket ??
            (storage.app.options as { storageBucket?: string }).storageBucket;
          const fileName = `${uuidv4()}`;
          const fullPath = `${location.parentPath}/${fileName}`;

          const ref = storage.refFromURL(`gs://${bucket}/${fullPath}`);
          await ref.put(file);

          // mimeTypeをsearchParamsに含めて返す
          const storedUrl = `gs://${bucket}/${fullPath}?mimeType=${encodeURIComponent(file.type)}`;
          return { url: storedUrl };
        },

        getDownloadUrl: async (storedUrl: string): Promise<{ url: string }> => {
          const url = new URL(storedUrl);
          const gsPath = `gs://${url.host}${url.pathname}`;
          const ref = storage.refFromURL(gsPath);
          // signedURLを取得
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
