/**
 * フォームの値として保存する文字列（`s3:///{key}?mimeType=...`）。
 * zod-form のファイルの項目は、保存先の URL と mimeType を 1 つの文字列で持つ。
 * バケットは入れない（サーバーの設定で決まる）。
 */

/** キーと mimeType から、保存する文字列を作る */
export const toStoredUrl = (key: string, mimeType: string): string =>
  `s3:///${key.split("/").map(encodeURIComponent).join("/")}?mimeType=${encodeURIComponent(mimeType)}`;

/** 保存した文字列から、キーを取り出す */
export const keyOfStoredUrl = (storedUrl: string): string => {
  const url = new URL(storedUrl);
  if (url.protocol !== "s3:") {
    throw new Error(`not an S3 stored url: ${storedUrl}`);
  }
  return url.pathname
    .replace(/^\/+/, "")
    .split("/")
    .map(decodeURIComponent)
    .join("/");
};
