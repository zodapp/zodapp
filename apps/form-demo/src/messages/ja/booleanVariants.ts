import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/booleanVariants";

/** form-demo の日本語の辞書（booleanVariants） */
export const ja = {
  "formDemo.page.booleanVariants.description":
    "スイッチ・チェックボックス・選択肢での入力と、「はい」「いいえ」の文言",
  "formDemo.booleanVariants.defaultSwitch": "既定（Switch）",
  "formDemo.booleanVariants.checkbox": "チェックボックス（uiType: checkbox）",
  "formDemo.booleanVariants.select": "セレクト（uiType: select）",
  "formDemo.booleanVariants.withLabels":
    "表示文言つき（trueLabel / falseLabel）",
  "formDemo.booleanVariants.withLabels.trueLabel": "公開する",
  "formDemo.booleanVariants.withLabels.falseLabel": "非公開にする",
  "formDemo.booleanVariants.readOnlyWithLabels":
    "読み取り表示（trueLabel / falseLabel が使われる）",
  "formDemo.booleanVariants.readOnlyWithLabels.trueLabel": "公開する",
  "formDemo.booleanVariants.readOnlyWithLabels.falseLabel": "非公開にする",
} satisfies MessagesOf<typeof en>;
