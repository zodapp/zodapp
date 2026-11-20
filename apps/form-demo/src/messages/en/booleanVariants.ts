import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（booleanVariants） */
export const en = defineMessages({
  "formDemo.page.booleanVariants.description":
    'Input with a switch, a checkbox, or a select, and the "Yes" / "No" texts',
  "formDemo.booleanVariants.defaultSwitch": "Default (Switch)",
  "formDemo.booleanVariants.checkbox": "Checkbox (uiType: checkbox)",
  "formDemo.booleanVariants.select": "Select (uiType: select)",
  "formDemo.booleanVariants.withLabels":
    "With display texts (trueLabel / falseLabel)",
  "formDemo.booleanVariants.withLabels.trueLabel": "Publish",
  "formDemo.booleanVariants.withLabels.falseLabel": "Keep private",
  "formDemo.booleanVariants.readOnlyWithLabels":
    "Read-only display (trueLabel / falseLabel are used)",
  "formDemo.booleanVariants.readOnlyWithLabels.trueLabel": "Publish",
  "formDemo.booleanVariants.readOnlyWithLabels.falseLabel": "Keep private",
});
