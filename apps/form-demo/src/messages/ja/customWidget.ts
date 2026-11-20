import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/customWidget";

/** form-demo の日本語の辞書（customWidget） */
export const ja = {
  "formDemo.page.customWidget.title": "カスタムウィジェット",
  "formDemo.page.customWidget.description":
    "wrapComponent + useZodField による自作フィールドコンポーネントと、componentLibrary への {zodType}_{uiType} キーでの登録（星評価・カスケード選択）",
} satisfies MessagesOf<typeof en>;
