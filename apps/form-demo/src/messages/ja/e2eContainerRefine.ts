import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eContainerRefine";

/** form-demo の日本語の辞書（e2eContainerRefine） */
export const ja = {
  "formDemo.page.e2eContainerRefine.title": "e2e：入れ物の refine",
  "formDemo.page.e2eContainerRefine.description":
    "object・array・record・union に、path を指定しない .refine() を付けた。入れ物の最後の欄を離すとエラーが出て、直すと消え、送信できる。期間は終了を開始より後に、メンバーは重複なしに、配分は合計 100 以下に、連絡先のメールは @example.com に",
  "formDemo.e2eContainerRefine.period.start": "開始",
  "formDemo.e2eContainerRefine.period.end": "終了",
  "formDemo.e2eContainerRefine.period.refine": "終了は開始より後にしてください",
  "formDemo.e2eContainerRefine.period": "期間（object）",
  "formDemo.e2eContainerRefine.members.item": "メンバー",
  "formDemo.e2eContainerRefine.members.refine": "メンバーが重複しています",
  "formDemo.e2eContainerRefine.members": "メンバー（array）",
  "formDemo.e2eContainerRefine.shares.key.a": "A 社",
  "formDemo.e2eContainerRefine.shares.key.b": "B 社",
  "formDemo.e2eContainerRefine.shares.refine":
    "配分の合計は 100 以下にしてください",
  "formDemo.e2eContainerRefine.shares": "配分（record）",
  "formDemo.e2eContainerRefine.contact.email.email": "メール",
  "formDemo.e2eContainerRefine.contact.email": "メール",
  "formDemo.e2eContainerRefine.contact.phone.phone": "電話番号",
  "formDemo.e2eContainerRefine.contact.phone": "電話",
  "formDemo.e2eContainerRefine.contact.refine":
    "メールは @example.com にしてください",
  "formDemo.e2eContainerRefine.contact": "連絡先（union）",
  "formDemo.e2eContainerRefine.contact.selectorLabel": "連絡先の種類",
  "formDemo.e2eContainerRefine.memo": "メモ",
} satisfies MessagesOf<typeof en>;
