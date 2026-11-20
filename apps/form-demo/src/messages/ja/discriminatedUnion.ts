import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/discriminatedUnion";

/** form-demo の日本語の辞書（discriminatedUnion） */
export const ja = {
  "formDemo.page.discriminatedUnion.description":
    "discriminated keyを使った安定したUnion。種類を切り替えると、種類どうしで共通の項目（窓口の名前・備考）は残り、前の種類だけの項目は消えて、新しい種類の既定の値が入る。元の種類に戻しても、前の値は戻らない。選ばれていない種類の選択の欄（チャネル）は、選択肢が変わっても値を消さない",
} satisfies MessagesOf<typeof en>;
