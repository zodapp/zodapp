import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/fixedValues";

/** form-demo の日本語の辞書（fixedValues） */
export const ja = {
  "formDemo.page.fixedValues.title": "固定値（hidden: false）",
  "formDemo.page.fixedValues.description":
    "値が 1 つに決まる型（値が 1 つの literal・z.null() など）は、既定では欄を出さず、値だけを入れる。meta に hidden: false と書くと、readOnly と同じ見た目で値を出す（必須の印は付けない）。どちらも、送信する値には固定値が入る。z.null() は中身が無いので、hidden: false でも出さない",
  "formDemo.fixedValues.article.kind": "種別",
  "formDemo.fixedValues.article.version": "版",
  "formDemo.fixedValues.article.title": "タイトル",
  "formDemo.fixedValues.article.deletedAt": "削除日時",
  "formDemo.fixedValues.article.contact.email.type": "連絡の種類",
  "formDemo.fixedValues.article.contact.email.email": "メール",
  "formDemo.fixedValues.article.contact.email": "メール",
  "formDemo.fixedValues.article.contact.phone.type": "連絡の種類",
  "formDemo.fixedValues.article.contact.phone.phone": "電話番号",
  "formDemo.fixedValues.article.contact.phone": "電話",
  "formDemo.fixedValues.article.contact": "連絡先",
  "formDemo.fixedValues.article.contact.selectorLabel": "連絡先の選び方",
  "formDemo.fixedValues.article.shown": "hidden: false（固定値を出す）",
  "formDemo.fixedValues.article.hidden": "既定（固定値を出さない）",
} satisfies MessagesOf<typeof en>;
