import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eUnsupported";

/** form-demo の日本語の辞書（e2eUnsupported） */
export const ja = {
  "formDemo.page.e2eUnsupported.title": "e2e：扱えない型の注記",
  "formDemo.page.e2eUnsupported.description":
    "rest 付きの tuple・uiType と要素の型が合わない配列・object を要素に持つ set は、その欄の場所に「扱えません」の注記を出し、ほかの欄は描く。使えないキー名（. を含む）は「このキー名は使えません」と出し、record に保存されていた使えないキーは編集できない行として出す。z.promise() と async の refine があるので、送信は止まり、理由が出る",
  "formDemo.e2eUnsupported.title": "見出し",
  "formDemo.e2eUnsupported.scores": "得点（rest 付きの tuple）",
  "formDemo.e2eUnsupported.numbers": "数の配列（uiType: multipleString）",
  "formDemo.e2eUnsupported.points": "点の集合（Set<object>）",
  "formDemo.e2eUnsupported.settings.a_b": "a.b の値",
  "formDemo.e2eUnsupported.settings.ok": "使える値",
  "formDemo.e2eUnsupported.settings": "設定（キー名に . を含む）",
  "formDemo.e2eUnsupported.tags": "タグ（保存値に使えないキー）",
  "formDemo.e2eUnsupported.pending": "取得中の値（promise）",
  "formDemo.e2eUnsupported.handle": "ハンドル（async の refine）",
} satisfies MessagesOf<typeof en>;
