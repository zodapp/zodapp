/**
 * デフォルトmediaResolversのエクスポート
 * zod-form-reactの基本resolversとMantine固有のresolversを結合
 */

import type { MediaResolvers } from "@zodapp/zod-form-react/media";
import {
  imageMediaResolver,
  videoMediaResolver,
  audioMediaResolver,
} from "@zodapp/zod-form-react";
import { genericMediaResolver } from "./generic";

/**
 * デフォルトmediaResolvers（Mantine版）
 * 基本的なresolvers + genericResolver（フォールバック）
 */
export const defaultMediaResolvers: MediaResolvers = [
  imageMediaResolver, // image/* → <img>
  videoMediaResolver, // video/* → <video>
  audioMediaResolver, // audio/* → <audio>
  genericMediaResolver, // * → ダウンロードリンク（フォールバック）
];

export { DataBasedPreview } from "./dataBasedPreview";
export { genericMediaResolver } from "./generic";

// Re-export from zod-form-react for convenience
export {
  imageMediaResolver,
  videoMediaResolver,
  audioMediaResolver,
} from "@zodapp/zod-form-react";
