/**
 * メディアプレビュー解決のための共通型定義
 */

import type React from "react";

/**
 * URL型mediaResolverのコンポーネントProps
 */
export type UrlPreviewProps = {
  url: string;
  mimeType: string;
};

/**
 * データ型mediaResolverのコンポーネントProps
 */
export type DataPreviewProps = {
  data: ArrayBuffer;
  mimeType: string;
};

/**
 * URL型mediaResolver
 * URLを直接受け入れるmediaResolver（<img>, <audio>, <video>など）
 */
export type MediaResolverUrlBased = {
  mimeType: string; // "image/*", "video/*", "*" などのパターン
  component: React.ComponentType<UrlPreviewProps>;
  acceptsUrl: true;
};

/**
 * データ型mediaResolver
 * データ（ArrayBuffer）を受け入れるmediaResolver（PDF, CSVなど）
 */
export type MediaResolverDataBased = {
  mimeType: string;
  component: React.ComponentType<DataPreviewProps>;
  acceptsUrl: false;
};

/**
 * mediaResolver（union型）
 */
export type MediaResolver = MediaResolverUrlBased | MediaResolverDataBased;

/**
 * mediaResolvers（配列で指定、優先順位が重要）
 */
export type MediaResolvers = MediaResolver[];
