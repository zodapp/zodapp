import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/fixedValues";

/** form-demo の日本語の辞書（fixedValues） */
export const ja = {
  "formDemo.page.fixedValues.title": "固定値（hidden: false）",
  "formDemo.page.fixedValues.description":
    "値が 1 つに決まる型（値が 1 つの literal・z.null() など）は、既定では欄を出さず、値だけを入れる。meta に hidden: false と書くと、readOnly と同じ見た目で値を出す（必須の印は付けない）。どちらも、送信する値には固定値が入る。z.null() は中身が無いので、hidden: false でも出さない",
} satisfies MessagesOf<typeof en>;
