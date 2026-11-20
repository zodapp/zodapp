import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eMisc";

/** form-demo の日本語の辞書（e2eMisc） */
export const ja = {
  "formDemo.page.e2eMisc.title": "e2e：そのほかの型の書き方",
  "formDemo.page.e2eMisc.description":
    "object の形の enum は、キーを選択肢の名前にし、選ぶと値を書く。zf.date に z.coerce.date() を渡せる。外部キーの土台に z.email() を使える（形に合わない値はエラー）。値を複数持つ literal を multipleEnum の要素にできる",
  "formDemo.e2eMisc.size": "サイズ（object の形の enum）",
  "formDemo.e2eMisc.dueDate": "期限（z.coerce.date()）",
  "formDemo.e2eMisc.contactEmail": "連絡先メール（externalKey + z.email()）",
  "formDemo.e2eMisc.colors": "色（literal の複数の値 × multipleEnum）",
} satisfies MessagesOf<typeof en>;
