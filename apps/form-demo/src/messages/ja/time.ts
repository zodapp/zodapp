import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/time";

/** form-demo の日本語の辞書（time） */
export const ja = {
  "formDemo.page.time.description":
    "時刻だけの入力。文字列でも、0 時からの数値でも持てる。欄を出るか Enter で値に入り、読めない時刻や範囲外の時刻は形のエラーになる。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる（開いただけでは書き換えない）",
} satisfies MessagesOf<typeof en>;
