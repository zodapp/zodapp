import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eOpenRewrite";

/** form-demo の日本語の辞書（e2eOpenRewrite） */
export const ja = {
  "formDemo.page.e2eOpenRewrite.title": "e2e：開いただけで書き換えるもの",
  "formDemo.page.e2eOpenRewrite.description":
    "開くと、選択肢に無い初期値を持つ clear の欄は値が消え、keep の欄は残ってエラーが出る。type の無い古い形の初期値を持つ preprocess の union は、type が補われる。precision の欄は初期値のまま。どれも開いただけでは isDirty は false で、欄を 1 つ編集すると true になる",
  "formDemo.e2eOpenRewrite.officeOptions.hq": "東京本社",
  "formDemo.e2eOpenRewrite.officeOptions.osaka": "大阪支社",
  "formDemo.e2eOpenRewrite.contactSchema.email.email": "メール",
  "formDemo.e2eOpenRewrite.contactSchema.email": "メール",
  "formDemo.e2eOpenRewrite.contactSchema.phone.phone": "電話番号",
  "formDemo.e2eOpenRewrite.contactSchema.phone": "電話",
  "formDemo.e2eOpenRewrite.contactSchema": "連絡先（preprocess の union）",
  "formDemo.e2eOpenRewrite.contactSchema.selectorLabel": "連絡先の種類",
  "formDemo.e2eOpenRewrite.officeClear": "拠点（clear）",
  "formDemo.e2eOpenRewrite.officeKeep": "拠点（keep）",
  "formDemo.e2eOpenRewrite.updatedAt": "更新日時（precision 0）",
  "formDemo.e2eOpenRewrite.openAt": "開店時刻（precision -1）",
  "formDemo.e2eOpenRewrite.memo": "メモ",
} satisfies MessagesOf<typeof en>;
