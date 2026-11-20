import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（recursiveSchema） */
export const en = defineMessages({
  "formDemo.page.recursiveSchema.description":
    "A recursive data structure with z.lazy",
  "formDemo.recursiveSchema.anyValueSchema.arm0": "Object",
  "formDemo.recursiveSchema.anyValueSchema.arm1": "String",
  "formDemo.recursiveSchema.anyValueSchema.arm2": "Number",
  "formDemo.recursiveSchema.anyValueSchema.arm3": "Boolean",
  "formDemo.recursiveSchema.anyValueSchema.arm4": "Date and time",
  "formDemo.recursiveSchema.anyValueSchema.arm5": "Big integer",
  "formDemo.recursiveSchema.anyValueSchema": "Any data",
  "formDemo.recursiveSchema.message.compute":
    'z.lazy can express nested structures. An object can hold more values of any type. "Organization" is a recursion whose depth is decided by a function (without optional, ending at department → section → team). A recursion without optional() is drawn up to the nesting limit (10 by default; change it with maxDepth in the z.lazy meta), and beyond that becomes a note. A recursion with optional or through an array is drawn as far as there are values, so the limit does not apply.',
  "formDemo.recursiveSchema.org.department": "Department",
  "formDemo.recursiveSchema.org.section": "Section",
  "formDemo.recursiveSchema.org.team": "Team",
  "formDemo.recursiveSchema.org.department.name": "Department name",
  "formDemo.recursiveSchema.org.section.name": "Section name",
  "formDemo.recursiveSchema.org.team.name": "Team name",
  "formDemo.recursiveSchema.org":
    "Organization (recursion whose depth is decided by a function: department → section → team)",
});
