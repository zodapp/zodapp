import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/zodBuiltins";

/** form-demo の日本語の辞書（zodBuiltins） */
export const ja = {
  "formDemo.page.zodBuiltins.title": "zod の型をそのまま使う",
  "formDemo.page.zodBuiltins.description":
    "pipe・transform・set・map・file・readonly・数値の enum・キーの決まった record・literal・optional な再帰を、zf を使わずに書いたときの表示",
} satisfies MessagesOf<typeof en>;
