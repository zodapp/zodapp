import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/basicInput";

/** form-demo の日本語の辞書（basicInput） */
export const ja = {
  "formDemo.page.basicInput.title": "基本",
  "formDemo.page.basicInput.description":
    "文字列、数値、真偽値、日付、BigIntの基本的な入力",
  "formDemo.basicInput.firstName": "名(string)",
  "formDemo.basicInput.lastName": "姓（string, 必須）",
  "formDemo.basicInput.frequency": "1週間にお酒を飲む日数(number, slider)",
  "formDemo.basicInput.age": "年齢(number)",
  "formDemo.basicInput.birthday": "誕生日(date)",
  "formDemo.basicInput.isMember": "会員(boolean)",
  "formDemo.basicInput.favoriteColor": "固定データ(literal)",
  "formDemo.basicInput.isConfirmed.literal": "承認してください",
  "formDemo.basicInput.isConfirmed":
    "承認済(literal型+booleanコンポーネントを強制)",
  "formDemo.basicInput.position": "座標(tuple)",
  "formDemo.basicInput.message.compute": "これは基本入力フォームのサンプルです",
} satisfies MessagesOf<typeof en>;
