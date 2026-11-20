import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/formatterAndSuggestions";

/** form-demo の日本語の辞書（formatterAndSuggestions） */
export const ja = {
  "formDemo.page.formatterAndSuggestions.description":
    "入力候補と、readOnly で表示するときの値の整形",
  "formDemo.formatterAndSuggestions.company": "会社名（suggestions: string[]）",
  "formDemo.formatterAndSuggestions.prefecture":
    "都道府県（suggestions: {label, value}[]）",
  "formDemo.formatterAndSuggestions.phone":
    "電話番号（formatter, readOnly表示で整形）",
  "formDemo.formatterAndSuggestions.amount":
    "金額（number formatter, readOnly表示で整形）",
  "formDemo.formatterAndSuggestions.status":
    "ステータス（formatterでbadgeを返す）",
  "formDemo.formatterAndSuggestions.status.formatter": "有効",
} satisfies MessagesOf<typeof en>;
