import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/schemaTransform";

/** form-demo の日本語の辞書（schemaTransform） */
export const ja = {
  "formDemo.page.schemaTransform.title": "スキーマ変形（ビュー派生）",
  "formDemo.page.schemaTransform.description":
    "1つのスキーマから hideSchemaFields / readOnlySchemaFields 系で権限別ビューやタブ分割ビューを派生させる",
} satisfies MessagesOf<typeof en>;
