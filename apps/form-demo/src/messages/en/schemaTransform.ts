import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（schemaTransform） */
export const en = defineMessages({
  "formDemo.page.schemaTransform.title": "Schema transforms (derived views)",
  "formDemo.page.schemaTransform.description":
    "Derive per-permission views and tabbed views from one schema with the hideSchemaFields / readOnlySchemaFields functions",
  "formDemo.schemaTransform.name": "Name",
  "formDemo.schemaTransform.email": "Email",
  "formDemo.schemaTransform.plan": "Plan",
  "formDemo.schemaTransform.rateLimit": "API rate limit (admin field)",
  "formDemo.schemaTransform.internalMemo": "Internal memo (admin field)",
  "formDemo.schemaTransform.view.admin.description":
    "Admin view: the base schema as is (all fields editable)",
  "formDemo.schemaTransform.view.member.description":
    "Member view: hide the admin fields (rateLimit / internalMemo) with hideSchemaFields",
  "formDemo.schemaTransform.view.viewer.description":
    "Viewer view: make all fields read-only with readOnlySchemaFieldsExcept([])",
  "formDemo.schemaTransform.view.partial.description":
    "Partial edit view: make fields other than name / email read-only with readOnlySchemaFields",
  "formDemo.schemaTransform.view.admin": "Admin",
  "formDemo.schemaTransform.view.member": "Member",
  "formDemo.schemaTransform.view.viewer": "View only",
  "formDemo.schemaTransform.view.partial": "Partial edit",
  "formDemo.schemaTransform.tabs.heading":
    "Tabs with hideSchemaFieldsExcept (one schema → multiple tabs)",
  "formDemo.schemaTransform.tabs.basic": "Basic settings",
  "formDemo.schemaTransform.tabs.admin": "Admin settings",
});
