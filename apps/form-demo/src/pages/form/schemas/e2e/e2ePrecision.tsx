import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

import { AutoForm } from "../../../../components/AutoForm";
import { createE2eHarness } from "../../../../components/E2eHarness";

export const formId = "e2e-precision";
export const title = "e2e：precision・unit で書かれる形";
export const description =
  "日時（Z あり・local）と時刻の、precision なし × unit（minute・second・millisecond）と、precision -1・0・3 の欄。開いただけでは値を書き換えない。編集すると決めた形で書く。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる";
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    // 日時（Z あり）
    utcMinute: z.iso.datetime().register(zf.date.registry, {
      label: "Z・unit minute",
      unit: "minute",
    }),
    utcSecond: z.iso.datetime().register(zf.date.registry, {
      label: "Z・unit second",
      unit: "second",
    }),
    utcMillisecond: z.iso.datetime().register(zf.date.registry, {
      label: "Z・unit millisecond",
      unit: "millisecond",
    }),
    utcPrecisionMinute: z.iso
      .datetime({ precision: -1 })
      .register(zf.date.registry, { label: "Z・precision -1" }),
    utcPrecisionSecond: z.iso
      .datetime({ precision: 0 })
      .register(zf.date.registry, { label: "Z・precision 0" }),
    utcPrecisionMillisecond: z.iso
      .datetime({ precision: 3 })
      .register(zf.date.registry, { label: "Z・precision 3" }),
    // 日時（local）
    localMinute: z.iso.datetime({ local: true }).register(zf.date.registry, {
      label: "local・unit minute",
      unit: "minute",
    }),
    localSecond: z.iso.datetime({ local: true }).register(zf.date.registry, {
      label: "local・unit second",
      unit: "second",
    }),
    localMillisecond: z.iso
      .datetime({ local: true })
      .register(zf.date.registry, {
        label: "local・unit millisecond",
        unit: "millisecond",
      }),
    localPrecisionMinute: z.iso
      .datetime({ local: true, precision: -1 })
      .register(zf.date.registry, { label: "local・precision -1" }),
    localPrecisionSecond: z.iso
      .datetime({ local: true, precision: 0 })
      .register(zf.date.registry, { label: "local・precision 0" }),
    localPrecisionMillisecond: z.iso
      .datetime({ local: true, precision: 3 })
      .register(zf.date.registry, { label: "local・precision 3" }),
    // 時刻
    timeMinute: z.iso.time().register(zf.time.registry, {
      label: "時刻・unit minute",
      unit: "minute",
    }),
    timeSecond: z.iso.time().register(zf.time.registry, {
      label: "時刻・unit second",
      unit: "second",
    }),
    timeMillisecond: z.iso.time().register(zf.time.registry, {
      label: "時刻・unit millisecond",
      unit: "millisecond",
    }),
    timePrecisionMinute: z.iso
      .time({ precision: -1 })
      .register(zf.time.registry, { label: "時刻・precision -1" }),
    timePrecisionSecond: z.iso
      .time({ precision: 0 })
      .register(zf.time.registry, { label: "時刻・precision 0" }),
    timePrecisionMillisecond: z.iso
      .time({ precision: 3 })
      .register(zf.time.registry, { label: "時刻・precision 3" }),
  })
  .register(zf.object.registry, {});

// 初期値は固定の日時（開いた時刻にしない）。precision なしの欄は、unit より細かい部分まで持たせる
export const defaultValues: z.input<typeof schema> = {
  utcMinute: "2026-03-14T09:26:53.589Z",
  utcSecond: "2026-03-14T09:26:53.589Z",
  utcMillisecond: "2026-03-14T09:26:53.589Z",
  utcPrecisionMinute: "2026-03-14T09:26Z",
  utcPrecisionSecond: "2026-03-14T09:26:53Z",
  utcPrecisionMillisecond: "2026-03-14T09:26:53.589Z",
  localMinute: "2026-03-14T09:26:53.589",
  localSecond: "2026-03-14T09:26:53.589",
  localMillisecond: "2026-03-14T09:26:53.589",
  localPrecisionMinute: "2026-03-14T09:26",
  localPrecisionSecond: "2026-03-14T09:26:53",
  localPrecisionMillisecond: "2026-03-14T09:26:53.589",
  timeMinute: "09:26:53.589",
  timeSecond: "09:26:53.589",
  timeMillisecond: "09:26:53.589",
  timePrecisionMinute: "09:26",
  timePrecisionSecond: "09:26:53",
  timePrecisionMillisecond: "09:26:53.589",
};

export type SchemaType = z.infer<typeof schema>;

const harness = [createE2eHarness<typeof schema>({ formId })];

export const Component = () => (
  <AutoForm
    schema={schema}
    defaultValues={defaultValues}
    actionComponents={harness}
  />
);
