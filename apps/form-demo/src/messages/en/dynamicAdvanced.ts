import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（dynamicAdvanced） */
export const en = defineMessages({
  "formDemo.page.dynamicAdvanced.title":
    "zf.dynamic (loading, subscribing, linking)",
  "formDemo.page.dynamicAdvanced.description":
    'Load a schema from a server (loading, failure, retry), a limit that keeps changing, and the state → city → neighborhood cascade. Changing the form type reloads only the form\'s fields. When a fetch fails, "Retry" appears and submission stops. Changing the state clears the city and the neighborhood in order. Choose when fetches arrive in "Try it"; with the hold mode, advance one fetch at a time with "Deliver" and "Fail"',
});
