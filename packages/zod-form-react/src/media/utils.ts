/**
 * メディア関連のユーティリティ関数
 */

import type { MediaResolvers, MediaResolver } from "./types";

/**
 * mimeTypeに応じたmediaResolverを検索する
 * 配列の先頭から順にマッチングを試み、最初にマッチしたものを返す
 * "*" は任意のmimeTypeにマッチする（フォールバック用）
 *
 * @param resolvers - mediaResolversの配列
 * @param mimeType - 対象のmimeType
 * @returns マッチしたmediaResolver、見つからなければundefined
 */
export function findMediaResolver(
  resolvers: MediaResolvers,
  mimeType: string,
): MediaResolver | undefined {
  return resolvers.find((resolver) => {
    if (resolver.mimeType === "*") return true;
    if (resolver.mimeType.endsWith("/*")) {
      // ワイルドカードパターン（例: "image/*"）
      const prefix = resolver.mimeType.slice(0, -2);
      return mimeType.startsWith(prefix);
    }
    return resolver.mimeType === mimeType;
  });
}
