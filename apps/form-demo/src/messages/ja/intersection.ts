import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/intersection";

/** form-demo の日本語の辞書（intersection） */
export const ja = {
  "formDemo.page.intersection.description":
    'intersection（a.and(b)）は、両側を同じ path に並べる。子の object・union に uiType: "flat" を付けると、枠を付けずに 1 つの object と同じ見た目で並ぶ。同じ path のエラー（子の object・union の腕の、path を指定しない .refine() を含む）は intersection が 1 回だけ出す。腕の中に出したいときは .refine() の path で欄を指す',
} satisfies MessagesOf<typeof en>;
