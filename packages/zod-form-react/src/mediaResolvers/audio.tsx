/**
 * AudioPreview
 * audio/* mimeType用のプレビューコンポーネント
 */

import { useMsg } from "../messages/useMsg";
import type { UrlPreviewProps, MediaResolverUrlBased } from "../media";

function AudioPreview({ url, mimeType: _mimeType }: UrlPreviewProps) {
  const msg = useMsg();
  return (
    <audio src={url} controls style={{ width: "100%" }}>
      {msg(
        "zodFormReact.media.audioUnsupported" /* i18n: お使いのブラウザは音声の再生に対応していません。 */,
      )}
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
