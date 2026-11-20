import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveBasicInput";

/** form-demo の日本語の辞書（reactiveBasicInput） */
export const ja = {
  "formDemo.page.reactiveBasicInput.title": "基本 (Reactive)",
  "formDemo.page.reactiveBasicInput.description":
    "reactiveComponentLibrary による基本入力。フィールド単位の確認UIあり。",
  "formDemo.reactiveBasicInput.firstName": "名(string)",
  "formDemo.reactiveBasicInput.lastName": "姓（string, 必須）",
  "formDemo.reactiveBasicInput.note": "メモ(string, 複数行)",
  "formDemo.reactiveBasicInput.frequency":
    "1週間にお酒を飲む日数(number, slider)",
  "formDemo.reactiveBasicInput.age": "年齢(number)",
  "formDemo.reactiveBasicInput.birthday": "誕生日(date)",
  "formDemo.reactiveBasicInput.isMember": "会員(boolean)",
  "formDemo.reactiveBasicInput.favoriteColor": "固定データ(literal)",
  "formDemo.reactiveBasicInput.isConfirmed.literal": "承認してください",
  "formDemo.reactiveBasicInput.isConfirmed":
    "承認済(literal型+booleanコンポーネントを強制)",
  "formDemo.reactiveBasicInput.message.compute":
    "これはReactive版の基本入力フォームサンプルです",
} satisfies MessagesOf<typeof en>;
