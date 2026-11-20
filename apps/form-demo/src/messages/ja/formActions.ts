import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/formActions";

/** form-demo の日本語の辞書（formActions） */
export const ja = {
  "formDemo.page.formActions.title": "カスタムアクション",
  "formDemo.page.formActions.description":
    "AutoForm の actions による複数ボタン（下書き保存 / 公開 / 破棄）と、フォーム状態に応じた disabled 述語",
  "formDemo.formActions.title.min": "タイトルを入力してください",
  "formDemo.formActions.title": "タイトル",
  "formDemo.formActions.body": "本文",
  "formDemo.formActions.actions.reset": "変更を破棄",
  "formDemo.formActions.actions.saveDraft": "下書き保存",
  "formDemo.formActions.actions.publish": "公開する",
  "formDemo.formActions.actions.savedVersion": ({ version }) =>
    `保存 v${version}`,
  "formDemo.formActions.published.title": "公開済みの内容",
  "formDemo.formActions.published.badge": "公開中",
} satisfies MessagesOf<typeof en>;
