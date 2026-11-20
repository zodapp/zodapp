import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/computedVariants";

/** form-demo の日本語の辞書（computedVariants） */
export const ja = {
  "formDemo.page.computedVariants.title": "zf.computed（表示の形）",
  "formDemo.page.computedVariants.description":
    "計算結果を、バッジ・リンク・アイコン・見出しとして表示する",
} satisfies MessagesOf<typeof en>;
