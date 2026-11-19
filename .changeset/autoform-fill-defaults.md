---
"@zodapp/zod-form-widget": minor
---

**Behavior change**：AutoForm は、開くときに `defaultValues` を `getDefaultValue(schema, defaultValues)` に通し、値が無いところを schema の既定値で補う（`.default()`・空の配列・object・値が 1 つの literal・`z.undefined()` のキーなど）。補った値は既定値に入るので、開いただけでは「変更あり」にならない。必須の object・intersection・配列は `{}`・`[]` で始まり、`onSubmit`・`onCancel` に渡る値にも補ったキーが入る。補えない schema（optional の付かない `z.lazy`）では補わずに続け、`console.error` を出す。AutoSearch と ReactiveAutoForm は補わない
