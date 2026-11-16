import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconClock } from "@tabler/icons-react";

export const formId = "time";
export const title = "zf.time";
export const description =
  "時刻だけの入力。文字列でも、0 時からの数値でも持てる。欄を出るか Enter で値に入り、読めない時刻や範囲外の時刻は形のエラーになる。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる（開いただけでは書き換えない）";
export const icon = IconClock;
export const category = "Basic";

export const schema = z
  .object({
    // 文字列: データの持ち方は zod の precision
    stringMinute: z.iso.time({ precision: -1 }).register(zf.time.registry, {
      label: 'z.iso.time({ precision: -1 }) - 分まで（"09:30"）',
    }),
    stringSecond: z.iso.time({ precision: 0 }).register(zf.time.registry, {
      label: 'z.iso.time({ precision: 0 }) - 秒まで（"09:30:15"）',
    }),
    stringUiMinute: z.iso.time().register(zf.time.registry, {
      label: "z.iso.time() - データは秒以下まで持てるが、UI は分まで",
      unit: "minute",
    }),
    stringUiSecond: z.iso.time().register(zf.time.registry, {
      label: "z.iso.time() - UI は秒まで。編集するとミリ秒は落ちる",
      unit: "second",
    }),
    stringUiMillisecond: z.iso.time().register(zf.time.registry, {
      label: "z.iso.time() - UI はミリ秒まで",
      unit: "millisecond",
    }),
    stringMillisecond: z.iso.time({ precision: 3 }).register(zf.time.registry, {
      label: "z.iso.time({ precision: 3 }) - ミリ秒まで",
    }),
    stringTenthSecond: z.iso.time({ precision: 1 }).register(zf.time.registry, {
      label: 'z.iso.time({ precision: 1 }) - 0.1 秒まで（"09:30:15.2"）',
    }),
    // 数値: データの持ち方は meta の encoding（0 時からの経過量、整数）
    numberHour: z.number().int().min(0).max(23).register(zf.time.registry, {
      label: "z.number() hoursOfDay - 時だけ（9 時なら 9）",
      encoding: "hoursOfDay",
    }),
    numberMinute: z.number().int().min(0).max(1439).register(zf.time.registry, {
      label: "z.number() minutesOfDay - 0 時からの分（9:30 なら 570）",
      encoding: "minutesOfDay",
    }),
    numberSecond: z
      .number()
      .int()
      .min(0)
      .max(86399)
      .register(zf.time.registry, {
        label: "z.number() secondsOfDay（既定）",
      }),
    numberMillisecond: z
      .number()
      .int()
      .min(0)
      .max(86_399_999)
      .register(zf.time.registry, {
        label:
          "z.number() millisecondsOfDay - 0 時からのミリ秒（9:30:15.250 なら 34215250）",
        encoding: "millisecondsOfDay",
      }),
    readOnly: z.number().register(zf.time.registry, {
      label: "readOnly",
      encoding: "minutesOfDay",
      readOnly: true,
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  stringMinute: "09:30",
  stringSecond: "09:30:15",
  stringUiMinute: "09:30:15.250",
  stringUiSecond: "09:30:15.250",
  stringUiMillisecond: "09:30:15.250",
  stringMillisecond: "09:30:15.250",
  stringTenthSecond: "09:30:15.2",
  numberHour: 9,
  numberMinute: 570,
  numberSecond: 34215,
  numberMillisecond: 34215250,
  readOnly: 570,
};

export type SchemaType = z.infer<typeof schema>;
