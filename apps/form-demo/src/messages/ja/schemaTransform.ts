import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/schemaTransform";

/** form-demo の日本語の辞書（schemaTransform） */
export const ja = {
  "formDemo.page.schemaTransform.title": "スキーマ変形（ビュー派生）",
  "formDemo.page.schemaTransform.description":
    "1つのスキーマから hideSchemaFields / readOnlySchemaFields 系で権限別ビューやタブ分割ビューを派生させる",
  "formDemo.schemaTransform.name": "名前",
  "formDemo.schemaTransform.email": "メール",
  "formDemo.schemaTransform.plan": "プラン",
  "formDemo.schemaTransform.rateLimit": "APIレート上限（管理者項目）",
  "formDemo.schemaTransform.internalMemo": "社内メモ（管理者項目）",
  "formDemo.schemaTransform.view.admin.description":
    "管理者ビュー: ベーススキーマそのまま（全項目編集可）",
  "formDemo.schemaTransform.view.member.description":
    "一般ビュー: hideSchemaFields で管理者項目（rateLimit / internalMemo）を非表示",
  "formDemo.schemaTransform.view.viewer.description":
    "閲覧ビュー: readOnlySchemaFieldsExcept([]) で全項目を読み取り専用に",
  "formDemo.schemaTransform.view.partial.description":
    "一部編集ビュー: readOnlySchemaFields で name / email 以外を読み取り専用に",
  "formDemo.schemaTransform.view.admin": "管理者",
  "formDemo.schemaTransform.view.member": "一般",
  "formDemo.schemaTransform.view.viewer": "閲覧のみ",
  "formDemo.schemaTransform.view.partial": "一部編集",
  "formDemo.schemaTransform.tabs.heading":
    "hideSchemaFieldsExcept によるタブ分割（1スキーマ → 複数タブ）",
  "formDemo.schemaTransform.tabs.basic": "基本設定",
  "formDemo.schemaTransform.tabs.admin": "管理者設定",
} satisfies MessagesOf<typeof en>;
