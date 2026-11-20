import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/formActions";

/** form-demo の日本語の辞書（formActions） */
export const ja = {
  "formDemo.page.formActions.title": "カスタムアクション",
  "formDemo.page.formActions.description":
    "AutoForm の actions による複数ボタン（下書き保存 / 公開 / 破棄）と、フォーム状態に応じた disabled 述語",
} satisfies MessagesOf<typeof en>;
