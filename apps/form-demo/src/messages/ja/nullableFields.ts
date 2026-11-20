import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/nullableFields";

/** form-demo の日本語の辞書（nullableFields） */
export const ja = {
  "formDemo.page.nullableFields.description":
    "空にしたときに書く値：nullable だけの欄は null（必須のエラーにならず、空のまま送信できる）、optional の欄（optional と nullable の両方を含む）は undefined。nullable の object は null で始まり、＋で開いて、削除で null に戻る",
  "formDemo.nullableFields.colorField.red": "赤",
  "formDemo.nullableFields.colorField.blue": "青",
  "formDemo.nullableFields.nullableText": "文字（nullable）",
  "formDemo.nullableFields.nullableNumber": "数値（nullable）",
  "formDemo.nullableFields.nullableColor": "色（nullable）",
  "formDemo.nullableFields.nullableDate": "日付（nullable）",
  "formDemo.nullableFields.optionalNullableText": "文字（optional・nullable）",
  "formDemo.nullableFields.optionalText": "文字（optional）",
  "formDemo.nullableFields.nullableDetail.note": "備考",
  "formDemo.nullableFields.nullableDetail.count": "件数",
  "formDemo.nullableFields.nullableDetail": "詳細（nullable）",
  "formDemo.nullableFields.optionalDetail.memo": "メモ",
  "formDemo.nullableFields.optionalDetail": "補足（optional）",
} satisfies MessagesOf<typeof en>;
