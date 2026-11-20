import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eLazyLimit） */
export const en = defineMessages({
  "formDemo.page.e2eLazyLimit.title": "e2e: recursion limit",
  "formDemo.page.e2eLazyLimit.description":
    'A recursion without optional (chain) has maxDepth: 2 and shows the note "Deeper levels cannot be shown" at the third level. Values beyond the note are kept (the chain is a type without an end, so submission stops at validation). A recursion with optional (tree) is drawn without the note as far as there are values, even with maxDepth: 2',
  "formDemo.e2eLazyLimit.chain.name": "Chain name",
  "formDemo.e2eLazyLimit.tree.name": "Tree name",
  "formDemo.e2eLazyLimit.chain": "Chain (without optional, maxDepth: 2)",
  "formDemo.e2eLazyLimit.tree": "Tree (optional, maxDepth: 2)",
});
