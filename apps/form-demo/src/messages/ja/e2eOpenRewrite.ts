import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eOpenRewrite";

/** form-demo の日本語の辞書（e2eOpenRewrite） */
export const ja = {
  "formDemo.page.e2eOpenRewrite.title": "e2e：開いただけで書き換えるもの",
  "formDemo.page.e2eOpenRewrite.description":
    "開くと、選択肢に無い初期値を持つ clear の欄は値が消え、keep の欄は残ってエラーが出る。type の無い古い形の初期値を持つ preprocess の union は、type が補われる。precision の欄は初期値のまま。どれも開いただけでは isDirty は false で、欄を 1 つ編集すると true になる",
} satisfies MessagesOf<typeof en>;
