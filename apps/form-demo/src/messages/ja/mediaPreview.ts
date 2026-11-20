import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/mediaPreview";

/** form-demo の日本語の辞書（mediaPreview） */
export const ja = {
  "formDemo.page.mediaPreview.title": "zf.externalFile（プレビューの種類）",
  "formDemo.page.mediaPreview.description":
    "アップロードしたファイルの mimeType に応じたプレビューの仕組み。標準の image / video / audio resolver、フォールバックの genericMediaResolver、自作の data ベース resolver（テキスト内容表示）",
  "formDemo.mediaPreview.image":
    "画像（imageMediaResolver → <img> プレビュー）",
  "formDemo.mediaPreview.audio":
    "音声（audioMediaResolver → <audio> プレビュー）",
  "formDemo.mediaPreview.textFile":
    "テキスト（自作の data ベース resolver で内容を表示）",
  "formDemo.mediaPreview.anyFile":
    "その他（genericMediaResolver → ダウンロードリンク）",
} satisfies MessagesOf<typeof en>;
