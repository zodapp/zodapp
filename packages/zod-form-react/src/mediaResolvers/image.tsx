/**
 * ImagePreview
 * image/* mimeType用のプレビューコンポーネント
 */

import type { UrlPreviewProps, MediaResolverUrlBased } from "../media";

function ImagePreview({ url, mimeType: _mimeType }: UrlPreviewProps) {
  return (
    <img
      src={url}
      alt="Preview"
      style={{ maxWidth: "100%", maxHeight: "400px", objectFit: "contain" }}
    />
  );
}

/**
 * `image/*` 用の media resolver。
 *
 * URL ベースの画像プレビュー（`<img>`）を提供します。
 */
export const imageMediaResolver: MediaResolverUrlBased = {
  mimeType: "image/*",
  component: ImagePreview,
  acceptsUrl: true,
};
