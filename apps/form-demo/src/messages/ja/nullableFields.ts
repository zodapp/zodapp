import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/nullableFields";

/** form-demo の日本語の辞書（nullableFields） */
export const ja = {
  "formDemo.page.nullableFields.description":
    "空にしたときに書く値：nullable だけの欄は null（必須のエラーにならず、空のまま送信できる）、optional の欄（optional と nullable の両方を含む）は undefined。nullable の object は null で始まり、＋で開いて、削除で null に戻る",
} satisfies MessagesOf<typeof en>;
