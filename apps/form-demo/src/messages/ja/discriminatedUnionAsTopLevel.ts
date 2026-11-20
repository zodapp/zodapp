import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/discriminatedUnionAsTopLevel";

/** form-demo の日本語の辞書（discriminatedUnionAsTopLevel） */
export const ja = {
  "formDemo.page.discriminatedUnionAsTopLevel.title":
    "z.discriminatedUnion（トップレベル）",
  "formDemo.page.discriminatedUnionAsTopLevel.description":
    "discriminated keyを使ったUnionをトップレベルスキーマとして直接使用する例",
} satisfies MessagesOf<typeof en>;
