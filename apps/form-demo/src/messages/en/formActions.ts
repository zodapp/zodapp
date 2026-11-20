import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（formActions） */
export const en = defineMessages({
  "formDemo.page.formActions.title": "Custom actions",
  "formDemo.page.formActions.description":
    "Multiple buttons with AutoForm actions (save draft / publish / discard) and disabled predicates based on the form state",
  "formDemo.formActions.title.min": "Enter a title",
  "formDemo.formActions.title": "Title",
  "formDemo.formActions.body": "Body",
  "formDemo.formActions.actions.reset": "Discard changes",
  "formDemo.formActions.actions.saveDraft": "Save draft",
  "formDemo.formActions.actions.publish": "Publish",
  "formDemo.formActions.actions.savedVersion": ({
    version,
  }: {
    version: string;
  }) => `Saved v${version}`,
  "formDemo.formActions.published.title": "Published content",
  "formDemo.formActions.published.badge": "Published",
});
