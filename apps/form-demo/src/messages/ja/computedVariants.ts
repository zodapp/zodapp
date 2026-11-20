import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/computedVariants";

/** form-demo の日本語の辞書（computedVariants） */
export const ja = {
  "formDemo.page.computedVariants.title": "zf.computed（表示の形）",
  "formDemo.page.computedVariants.description":
    "計算結果を、バッジ・リンク・アイコン・見出しとして表示する",
  "formDemo.computedVariants.status.active": "有効",
  "formDemo.computedVariants.status.archived": "アーカイブ",
  "formDemo.computedVariants.status.draft": "下書き",
  "formDemo.computedVariants.status": "ステータス（編集用）",
  "formDemo.computedVariants.statusBadge": "ステータス（computedでバッジ表示）",
  "formDemo.computedVariants.firstName": "名",
  "formDemo.computedVariants.lastName": "姓",
  "formDemo.computedVariants.fullName": "氏名（computedで結合）",
  "formDemo.computedVariants.homepageLink": "リンク（type: link）",
  "formDemo.computedVariants.priority": "アイコン（type: icon）",
  "formDemo.computedVariants.heading.compute": "ComputedValue の表示型デモ",
  "formDemo.computedVariants.priority.compute": "高",
  "formDemo.computedVariants.statusBadge.active": "有効",
  "formDemo.computedVariants.statusBadge.archived": "アーカイブ",
  "formDemo.computedVariants.statusBadge.draft": "下書き",
} satisfies MessagesOf<typeof en>;
