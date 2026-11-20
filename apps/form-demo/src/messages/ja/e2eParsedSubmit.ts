import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eParsedSubmit";

/** form-demo の日本語の辞書（e2eParsedSubmit） */
export const ja = {
  "formDemo.page.e2eParsedSubmit.title": "e2e：送信する値の変換",
  "formDemo.page.e2eParsedSubmit.description":
    "onSubmit には parse した値（z.output）が渡る。名前は前後の空白を外し、コードは大文字にし、数（codec）は数にし、同意（stringbool）は true / false にし、略称は 3 文字未満なら n/a にする。役割（default）とニックネーム（prefault）は、開くときに既定値で補い、開いただけでは isDirty は false",
} satisfies MessagesOf<typeof en>;
