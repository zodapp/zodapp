import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（mediaPreview） */
export const en = defineMessages({
  "formDemo.page.mediaPreview.title": "zf.externalFile (preview types)",
  "formDemo.page.mediaPreview.description":
    "How previews follow the mimeType of uploaded files: the standard image / video / audio resolvers, the fallback genericMediaResolver, and a custom data-based resolver (showing text content)",
});
