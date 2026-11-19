/**
 * VideoPreview
 * video/* mimeType用のプレビューコンポーネント
 */

import { useMsg } from "../messages/useMsg";
import type { UrlPreviewProps, MediaResolverUrlBased } from "../media";

function VideoPreview({ url, mimeType: _mimeType }: UrlPreviewProps) {
  const msg = useMsg();
  return (
    <video src={url} controls style={{ maxWidth: "100%", maxHeight: "400px" }}>
      {msg(
        "zodFormReact.media.videoUnsupported" /* お使いのブラウザは動画の再生に対応していません。 */,
      )}
    </video>
  );
}

/**
 * `video/*` 用の media resolver。
 *
 * URL ベースの動画プレビュー（`<video controls>`）を提供します。
 */
export const videoMediaResolver: MediaResolverUrlBased = {
  mimeType: "video/*",
  component: VideoPreview,
  acceptsUrl: true,
};
