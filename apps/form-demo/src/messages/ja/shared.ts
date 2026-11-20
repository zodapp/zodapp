import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/shared";

/** form-demo の日本語の辞書（shared） */
export const ja = {
  "formDemo.shared.tryBehavior.legend": "動きを試す",
  "formDemo.shared.fetch.mode.human": "見やすい遅延",
  "formDemo.shared.fetch.mode.immediate": "すぐ届く",
  "formDemo.shared.fetch.mode.frame1": "1 フレーム後",
  "formDemo.shared.fetch.mode.frame2": "2 フレーム後",
  "formDemo.shared.fetch.mode.held": "止めておく",
  "formDemo.shared.fetch.delayMode": "遅延の分け方",
  "formDemo.shared.fetch.selectedMode": ({ mode }) => `選んだ分け方：${mode}`,
  "formDemo.shared.fetch.failing":
    "取得を失敗させる（オンのあいだに届く取得は失敗する）",
  "formDemo.shared.fetch.pending": ({ count }) =>
    `待っている取得（${count} 件）`,
  "formDemo.shared.fetch.pendingNone": "：なし",
  "formDemo.shared.fetch.deliver": "届ける",
  "formDemo.shared.fetch.fail": "失敗させる",
  "formDemo.shared.fetch.failedError": "取得に失敗しました（デモ）",
} satisfies MessagesOf<typeof en>;
