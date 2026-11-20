import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2ePassthrough";

/** form-demo の日本語の辞書（e2ePassthrough） */
export const ja = {
  "formDemo.page.e2ePassthrough.title": "e2e：欄を出さずにそのまま送る型",
  "formDemo.page.e2ePassthrough.description":
    "z.any()・z.unknown()・z.custom()・z.symbol()・z.function()・z.never()（optional）・z.nan() は欄を出さず、初期値をそのまま送る。z.templateLiteral() は文字列の欄になり、形に合わないとエラーになる。.nonoptional() は中の欄を描き、空なら送信が止まる",
} satisfies MessagesOf<typeof en>;
