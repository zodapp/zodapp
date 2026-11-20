import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/readOnly";

/** form-demo の日本語の辞書（readOnly） */
export const ja = {
  "formDemo.page.readOnly.title": "閲覧専用の表示",
  "formDemo.page.readOnly.description": "readOnlyモード",
  "formDemo.readOnly.hobbyLiterals.reading": "読書",
  "formDemo.readOnly.hobbyLiterals.sports": "スポーツ",
  "formDemo.readOnly.hobbyLiterals.music": "音楽",
  "formDemo.readOnly.hobbyLiterals.gaming": "ゲーム",
  "formDemo.readOnly.contactSchema.email.email.email":
    "有効なメールアドレスを入力してください",
  "formDemo.readOnly.contactSchema.email.email": "メール",
  "formDemo.readOnly.contactSchema.email": "メール連絡",
  "formDemo.readOnly.contactSchema.phone.phone": "電話番号",
  "formDemo.readOnly.contactSchema.phone": "電話連絡",
  "formDemo.readOnly.contactSchema": "連絡先",
  "formDemo.readOnly.contactSchema.selectorLabel": "連絡先タイプ",
  "formDemo.readOnly.firstName": "名(string)",
  "formDemo.readOnly.lastName": "姓（string, 必須）",
  "formDemo.readOnly.frequency": "1週間にお酒を飲む日数(number, slider)",
  "formDemo.readOnly.age": "年齢(number)",
  "formDemo.readOnly.birthday": "誕生日(date)",
  "formDemo.readOnly.isMember": "会員(boolean)",
  "formDemo.readOnly.favoriteColor": "固定データ(literal)",
  "formDemo.readOnly.isConfirmed.literal": "承認してください",
  "formDemo.readOnly.isConfirmed":
    "承認済(literal型+booleanコンポーネントを強制)",
  "formDemo.readOnly.position": "座標(tuple)",
  "formDemo.readOnly.favoriteHobby": "一番好きな趣味(enum)",
  "formDemo.readOnly.hobbies": "趣味(array enum)",
  "formDemo.readOnly.message.compute": "これはreadOnlyモードのサンプルです",
} satisfies MessagesOf<typeof en>;
