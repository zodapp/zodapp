import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（app） */
export const en = defineMessages({
  "formDemo.app.home.tagline":
    "An AI-native, schema-driven development framework",
  "formDemo.app.home.features": "Features",
  "formDemo.app.home.schemaFirst.title": "Schema-first development",
  "formDemo.app.home.schemaFirst.body":
    "Generate type definitions, form UIs, and DynamoDB integration from one schema.",
  "formDemo.app.home.metadata.title": "Metadata extension system",
  "formDemo.app.home.metadata.body":
    "Built on Zod schemas, it attaches UI information such as labels and display options to the schema, making the most of the Zod ecosystem.",
  "formDemo.app.home.aiNative.title": "AI-native design",
  "formDemo.app.home.aiNative.body":
    "It removes the need to check the relations between multiple schemas, maximizing the efficiency of AI development and making it much easier for people to review the results of AI coding. A development framework for the age of AI coding.",
  "formDemo.app.home.demos": "Demos",
  "formDemo.app.demo.form.label": "Forms",
  "formDemo.app.demo.form.title": "Form demo",
  "formDemo.app.demo.form.description":
    "A catalog of form UIs generated from one Zod schema: input types, layouts, custom widgets, dynamic schemas, and more.",
  "formDemo.app.list.title": "Schemas",
  "formDemo.app.list.description":
    "Sample forms generated automatically from Zod schemas. Click a card to see the details.",
  "formDemo.app.nav.backToTop": "Back to top",
  "formDemo.app.nav.list": "List",
  "formDemo.app.nav.schemas": "Schemas",
  "formDemo.app.layout.closeSidebar": "Close sidebar",
  "formDemo.app.layout.openSidebar": "Open sidebar",
  "formDemo.app.detail.tabForm": "Preview",
  "formDemo.app.detail.tabCode": "Code",
  "formDemo.app.harness.submit": "Submit",
  "formDemo.app.harness.submitted": ({ count }: { count: string }) =>
    `Submitted: ${count} times`,
  "formDemo.app.harness.submittedValues": ({ values }: { values: string }) =>
    ` (submitted values: ${values})`,
  "formDemo.app.harness.errors": "Errors:",
  "formDemo.app.harness.noErrors": "none",
  "formDemo.app.harness.formError": ({ message }: { message: string }) =>
    `(form) ${message}`,
  "formDemo.app.harness.errorSeparator": ", ",
  "formDemo.app.harness.log": ({ count }: { count: string }) =>
    `Log (${count} entries)`,
  "formDemo.app.harness.unnamed": "(unnamed)",
  "formDemo.app.harness.logValue": ({ changes }: { changes: string }) =>
    `value: ${changes}`,
  "formDemo.app.harness.logFetch": ({
    kind,
    field,
    key,
    result,
  }: {
    kind: string;
    field: string;
    key: string;
    result: string;
  }) => `fetch (${kind}): ${field} key=${key} ${result}`,
  "formDemo.app.harness.fetch.called": "called",
  "formDemo.app.harness.fetch.delivered": "delivered",
  "formDemo.app.harness.fetch.failed": "failed",
  "formDemo.app.harness.logDynamic": ({ statuses }: { statuses: string }) =>
    `dynamic status: ${statuses}`,
  "formDemo.app.harness.noDynamic": "no loading or failed fields",
  "formDemo.app.harness.logSubmit": ({ result }: { result: string }) =>
    `submit: ${result}`,
  "formDemo.app.harness.submit.attempted": "attempted",
  "formDemo.app.harness.submit.passed": "passed",
  "formDemo.app.harness.submit.blocked": "blocked",
});
