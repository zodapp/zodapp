/**
 * 基本mediaResolversのエクスポート
 * Mantine非依存の基本的なmediaResolvers
 */

import type { MediaResolvers } from "../media";
import { imageMediaResolver } from "./image";
import { videoMediaResolver } from "./video";
import { audioMediaResolver } from "./audio";

/**
 * 基本的なmediaResolvers（Mantine非依存）
 * image, video, audio のみを含む
 * 注: genericResolver（フォールバック）はzod-form-mantineで提供
 */
export const basicMediaResolvers: MediaResolvers = [
  imageMediaResolver, // image/* → <img>
  videoMediaResolver, // video/* → <video>
  audioMediaResolver, // audio/* → <audio>
];

export { imageMediaResolver } from "./image";
export { videoMediaResolver } from "./video";
export { audioMediaResolver } from "./audio";
