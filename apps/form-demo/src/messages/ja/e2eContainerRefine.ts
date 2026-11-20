import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eContainerRefine";

/** form-demo の日本語の辞書（e2eContainerRefine） */
export const ja = {
  "formDemo.page.e2eContainerRefine.title": "e2e：入れ物の refine",
  "formDemo.page.e2eContainerRefine.description":
    "object・array・record・union に、path を指定しない .refine() を付けた。入れ物の最後の欄を離すとエラーが出て、直すと消え、送信できる。期間は終了を開始より後に、メンバーは重複なしに、配分は合計 100 以下に、連絡先のメールは @example.com に",
} satisfies MessagesOf<typeof en>;
