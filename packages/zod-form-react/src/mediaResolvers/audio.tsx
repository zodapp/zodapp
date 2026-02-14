/**
 * AudioPreview
 * audio/* mimeType用のプレビューコンポーネント
 */

import type { UrlPreviewProps, MediaResolverUrlBased } from "../media";

function AudioPreview({ url, mimeType: _mimeType }: UrlPreviewProps) {
  return (
    <audio src={url} controls style={{ width: "100%" }}>
      お使いのブラウザは音声の再生に対応していません。
    </audio>
  );
}

/**
 * `audio/*` 用の media resolver。
 *
 * URL ベースの音声プレビュー（`<audio controls>`）を提供します。
 */
export const audioMediaResolver: MediaResolverUrlBased = {
  mimeType: "audio/*",
  component: AudioPreview,
  acceptsUrl: true,
};
