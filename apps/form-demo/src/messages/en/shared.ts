import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（shared） */
export const en = defineMessages({
  "formDemo.shared.tryBehavior.legend": "Try it",
  "formDemo.shared.fetch.mode.human": "Visible delay",
  "formDemo.shared.fetch.mode.immediate": "Immediately",
  "formDemo.shared.fetch.mode.frame1": "After 1 frame",
  "formDemo.shared.fetch.mode.frame2": "After 2 frames",
  "formDemo.shared.fetch.mode.held": "Hold",
  "formDemo.shared.fetch.delayMode": "Delay mode",
  "formDemo.shared.fetch.selectedMode": ({ mode }: { mode: string }) =>
    `Selected mode: ${mode}`,
  "formDemo.shared.fetch.failing":
    "Make fetches fail (fetches that arrive while this is on fail)",
  "formDemo.shared.fetch.pending": ({ count }: { count: string }) =>
    `Pending fetches (${count})`,
  "formDemo.shared.fetch.pendingNone": ": none",
  "formDemo.shared.fetch.deliver": "Deliver",
  "formDemo.shared.fetch.fail": "Fail",
  "formDemo.shared.fetch.failedError": "Fetch failed (demo)",
});
