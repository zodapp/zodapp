import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/time";

/** form-demo の日本語の辞書（time） */
export const ja = {
  "formDemo.page.time.description":
    "時刻だけの入力。文字列でも、0 時からの数値でも持てる。欄を出るか Enter で値に入り、読めない時刻や範囲外の時刻は形のエラーになる。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる（開いただけでは書き換えない）",
  "formDemo.time.stringMinute":
    'z.iso.time({ precision: -1 }) - 分まで（"09:30"）',
  "formDemo.time.stringSecond":
    'z.iso.time({ precision: 0 }) - 秒まで（"09:30:15"）',
  "formDemo.time.stringUiMinute":
    "z.iso.time() - データは秒以下まで持てるが、UI は分まで",
  "formDemo.time.stringUiSecond":
    "z.iso.time() - UI は秒まで。編集するとミリ秒は落ちる",
  "formDemo.time.stringUiMillisecond": "z.iso.time() - UI はミリ秒まで",
  "formDemo.time.stringMillisecond":
    "z.iso.time({ precision: 3 }) - ミリ秒まで",
  "formDemo.time.stringTenthSecond":
    'z.iso.time({ precision: 1 }) - 0.1 秒まで（"09:30:15.2"）',
  "formDemo.time.numberHour": "z.number() hoursOfDay - 時だけ（9 時なら 9）",
  "formDemo.time.numberMinute":
    "z.number() minutesOfDay - 0 時からの分（9:30 なら 570）",
  "formDemo.time.numberSecond": "z.number() secondsOfDay（既定）",
  "formDemo.time.numberMillisecond":
    "z.number() millisecondsOfDay - 0 時からのミリ秒（9:30:15.250 なら 34215250）",
} satisfies MessagesOf<typeof en>;
