import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/computed";

/** form-demo の日本語の辞書（computed） */
export const ja = {
  "formDemo.page.computed.description":
    "他の項目の値から計算した結果を表示する",
  "formDemo.computed.unitPrice": "単価（円）",
  "formDemo.computed.quantity": "数量",
  "formDemo.computed.total": "合計金額",
  "formDemo.computed.other.unitPrice": "単価（円）",
  "formDemo.computed.other.quantity": "数量",
  "formDemo.computed.other.total": "合計金額",
  "formDemo.computed.other": "入れ子の場合",
} satisfies MessagesOf<typeof en>;
