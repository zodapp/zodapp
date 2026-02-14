/**
 * ファイル関連のユーティリティ関数
 */

/**
 * URLからmimeTypeを抽出する
 * searchParamsに "mimeType" があればその値を返す
 *
 * @param url - 対象のURL文字列
 * @returns mimeType文字列、見つからなければundefined
 */
export function parseMimeTypeFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("mimeType") ?? undefined;
  } catch {
    return undefined;
  }
}
