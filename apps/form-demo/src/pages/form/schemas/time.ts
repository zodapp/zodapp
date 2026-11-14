import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconClock } from "@tabler/icons-react";

export const formId = "time";
export const title = "時刻";
export const description =
  "時刻だけの入力（文字列と 0 時からの数値、データの持ち方と UI 上の精度）";
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
    stringMillisecond: z.iso.time({ precision: 3 }).register(zf.time.registry, {
      label: "z.iso.time({ precision: 3 }) - ミリ秒まで",
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
  stringMillisecond: "09:30:15.250",
  numberHour: 9,
  numberMinute: 570,
  numberSecond: 34215,
  readOnly: 570,
};

export type SchemaType = z.infer<typeof schema>;
