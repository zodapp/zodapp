import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/unionArms";

/** form-demo の日本語の辞書（unionArms） */
export const ja = {
  "formDemo.page.unionArms.title": "zf.union（いろいろな腕）",
  "formDemo.page.unionArms.description":
    "discriminator のない union に、文字列・数値・真偽値・選択肢・literal・オブジェクトの腕を混ぜる。選んだ腕を覚え、値はその腕の型で書く（数値の腕なら number）。どちらの腕にも通る値は、選んだ腕のまま。値が外から変わり、今の腕に通らなくなったら、通る腕に切り替える",
  "formDemo.unionArms.textNumberObjectArms.arm0.min":
    "3文字以上で入力してください",
  "formDemo.unionArms.textNumberObjectArms.arm0": "文字列",
  "formDemo.unionArms.textNumberObjectArms.arm1.multipleOf":
    "5の倍数で入力してください",
  "formDemo.unionArms.textNumberObjectArms.arm1": "数値",
  "formDemo.unionArms.textNumberObjectArms.arm2.text.min":
    "本文は3文字以上で入力してください",
  "formDemo.unionArms.textNumberObjectArms.arm2.text": "本文",
  "formDemo.unionArms.textNumberObjectArms.arm2": "オブジェクト",
  "formDemo.unionArms.answerArms.arm0": "はい・いいえ",
  "formDemo.unionArms.answerArms.unknown": "わからない",
  "formDemo.unionArms.answerArms.arm2.min": "1文字以上で入力してください",
  "formDemo.unionArms.answerArms.arm2": "その他（自由に書く）",
  "formDemo.unionArms.value": "値（文字列・数値・オブジェクト）",
  "formDemo.unionArms.value.selectorLabel": "値の種類",
  "formDemo.unionArms.code": "番号（文字列か数値）",
  "formDemo.unionArms.code.selectorLabel": "番号の書き方",
  "formDemo.unionArms.size.arm0": "選ぶ",
  "formDemo.unionArms.size.arm1": "自由に書く",
  "formDemo.unionArms.size": "サイズ（選ぶか、自由に書く）",
  "formDemo.unionArms.size.selectorLabel": "サイズの決め方",
  "formDemo.unionArms.answer": "回答（真偽値・literal・文字列）",
  "formDemo.unionArms.answer.selectorLabel": "回答のしかた",
  "formDemo.unionArms.memo": "メモ（optional。空のままでよい）",
  "formDemo.unionArms.memo.selectorLabel": "メモの種類",
  "formDemo.unionArms.note": "備考（nullable。空のままでよい）",
  "formDemo.unionArms.note.selectorLabel": "備考の種類",
  "formDemo.unionArms.required": "必須の値（空のまま送信するとエラー）",
  "formDemo.unionArms.required.selectorLabel": "必須の値の種類",
  "formDemo.unionArms.items.item.selectorLabel": "項目の種類",
  "formDemo.unionArms.items": "項目（配列の中の union）",
  "formDemo.unionArms.readOnlyView.text": "文字列の腕",
  "formDemo.unionArms.readOnlyView.text.selectorLabel": "種類（文字列）",
  "formDemo.unionArms.readOnlyView.number": "数値の腕",
  "formDemo.unionArms.readOnlyView.number.selectorLabel": "種類（数値）",
  "formDemo.unionArms.readOnlyView.object": "オブジェクトの腕",
  "formDemo.unionArms.readOnlyView.object.selectorLabel":
    "種類（オブジェクト）",
  "formDemo.unionArms.readOnlyView.boolean": "真偽値の腕",
  "formDemo.unionArms.readOnlyView.boolean.selectorLabel": "種類（真偽値）",
  "formDemo.unionArms.readOnlyView.literal": "literal の腕",
  "formDemo.unionArms.readOnlyView.literal.selectorLabel": "種類（literal）",
  "formDemo.unionArms.readOnlyView": "読み取り専用の欄",
  "formDemo.unionArms.draft.text.text.min": "本文を入力してください",
  "formDemo.unionArms.draft.text.text": "下書きの本文",
  "formDemo.unionArms.draft.text": "文章",
  "formDemo.unionArms.draft.amount.amount": "下書きの金額",
  "formDemo.unionArms.draft.amount": "金額",
  "formDemo.unionArms.draft":
    "下書き（途中まで入力して保存した値。type から腕を推定する）",
  "formDemo.unionArms.draft.selectorLabel": "下書きの種類",
  "formDemo.unionArms.unknownSaved":
    "どの腕にも当てはまらない保存値（腕は空欄で開く）",
  "formDemo.unionArms.unknownSaved.selectorLabel": "保存値の種類",
  "formDemo.unionArms.arms.asText": "文字列として書く",
  "formDemo.unionArms.arms.asNumber": "数値として書く",
  "formDemo.unionArms.arms.text": "文字",
  "formDemo.unionArms.arms.number": "数",
  "formDemo.unionArms.arms.string": "文字列",
  "formDemo.unionArms.arms.numeric": "数値",
  "formDemo.unionArms.harness.writeNumber":
    "外から書き込む（値を数値の 10 にする）",
  "formDemo.unionArms.harness.writeObject":
    "外から書き込む（値をオブジェクトにする）",
  "formDemo.unionArms.harness.writeString":
    "外から書き込む（値を文字列にする）",
} satisfies MessagesOf<typeof en>;
