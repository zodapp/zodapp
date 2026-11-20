import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/unionArms";

/** form-demo の日本語の辞書（unionArms） */
export const ja = {
  "formDemo.page.unionArms.title": "zf.union（いろいろな腕）",
  "formDemo.page.unionArms.description":
    "discriminator のない union に、文字列・数値・真偽値・選択肢・literal・オブジェクトの腕を混ぜる。選んだ腕を覚え、値はその腕の型で書く（数値の腕なら number）。どちらの腕にも通る値は、選んだ腕のまま。値が外から変わり、今の腕に通らなくなったら、通る腕に切り替える",
} satisfies MessagesOf<typeof en>;
