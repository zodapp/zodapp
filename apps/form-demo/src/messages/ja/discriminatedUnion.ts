import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/discriminatedUnion";

/** form-demo の日本語の辞書（discriminatedUnion） */
export const ja = {
  "formDemo.page.discriminatedUnion.description":
    "discriminated keyを使った安定したUnion。種類を切り替えると、種類どうしで共通の項目（窓口の名前・備考）は残り、前の種類だけの項目は消えて、新しい種類の既定の値が入る。元の種類に戻しても、前の値は戻らない。選ばれていない種類の選択の欄（チャネル）は、選択肢が変わっても値を消さない",
  "formDemo.discriminatedUnion.contactSchema.email.email.email":
    "有効なメールアドレスを入力してください",
  "formDemo.discriminatedUnion.contactSchema.email.email": "メール",
  "formDemo.discriminatedUnion.contactSchema.email.note": "備考",
  "formDemo.discriminatedUnion.contactSchema.email": "メール連絡",
  "formDemo.discriminatedUnion.contactSchema.phone.phoneType.mobile":
    "携帯電話",
  "formDemo.discriminatedUnion.contactSchema.phone.phoneType.landline":
    "固定電話",
  "formDemo.discriminatedUnion.contactSchema.phone.phoneType": "電話番号タイプ",
  "formDemo.discriminatedUnion.contactSchema.phone.phone": "電話番号",
  "formDemo.discriminatedUnion.contactSchema.phone.note": "備考",
  "formDemo.discriminatedUnion.contactSchema.phone": "電話連絡",
  "formDemo.discriminatedUnion.contactSchema": "連絡先",
  "formDemo.discriminatedUnion.contactSchema.selectorLabel": "連絡先タイプ",
  "formDemo.discriminatedUnion.legacyContactSchema":
    "連絡先（z.preprocess で包んだ union。初期値は type の無い古い形）",
  "formDemo.discriminatedUnion.legacyContactSchema.selectorLabel":
    "連絡先タイプ",
  "formDemo.discriminatedUnion.deskCommon.name": "名前",
  "formDemo.discriminatedUnion.deskCommon.note": "備考",
  "formDemo.discriminatedUnion.deskSchema.store.address": "住所",
  "formDemo.discriminatedUnion.deskSchema.store": "店舗",
  "formDemo.discriminatedUnion.deskSchema.online.channel": "チャネル",
  "formDemo.discriminatedUnion.deskSchema.online": "オンライン",
  "formDemo.discriminatedUnion.deskSchema":
    "窓口（種類どうしで共通の項目を持つ）",
  "formDemo.discriminatedUnion.deskSchema.selectorLabel": "窓口の種類",
  "formDemo.discriminatedUnion.message.compute":
    "Discriminated Unionは、識別子（type）によって型を判別します。通常のUnionよりパフォーマンスやメンテナンス性に優れています。",
  "formDemo.discriminatedUnion.try.description":
    "オンラインの窓口のチャネルの選択肢を届け直す。店舗を選んでいるあいだは、チャネルの欄は描かれていないので、値は消えない",
  "formDemo.discriminatedUnion.try.removeChat": "チャットを選択肢から外す",
  "formDemo.discriminatedUnion.try.restore": "選択肢を戻す",
} satisfies MessagesOf<typeof en>;
