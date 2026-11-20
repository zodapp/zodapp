import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eLazyLimit";

/** form-demo の日本語の辞書（e2eLazyLimit） */
export const ja = {
  "formDemo.page.e2eLazyLimit.title": "e2e：再帰の上限",
  "formDemo.page.e2eLazyLimit.description":
    "optional の付かない再帰（鎖）は maxDepth: 2 で、3 段目に「これより深い階層は表示できません」の注記を出す。注記の先の値は消さない（鎖は終わりの無い型なので、送信は検証で止まる）。optional な再帰（木）は maxDepth: 2 でも、値のある所まで注記なしで描く",
  "formDemo.e2eLazyLimit.chain.name": "鎖の名前",
  "formDemo.e2eLazyLimit.tree.name": "木の名前",
  "formDemo.e2eLazyLimit.chain": "鎖（optional なし。maxDepth: 2）",
  "formDemo.e2eLazyLimit.tree": "木（optional。maxDepth: 2）",
} satisfies MessagesOf<typeof en>;
