import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

import { AutoForm } from "../../../../components/AutoForm";
import { createE2eHarness } from "../../../../components/E2eHarness";

export const formId = "e2e-time-input";
export const title = "e2e：時刻の打ち込み";
export const description =
  "時刻の欄に、キーを一つずつ押して打つ。欄を出るか Enter で値に入る。途中の桁を Backspace で消して打ち直しても、打ったとおりになる。読めない値や範囲外の値で欄を出ると、形のエラーが出て送信が止まる";
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    millisecond: z.iso.time({ precision: 3 }).register(zf.time.registry, {
      label: "z.iso.time({ precision: 3 })",
    }),
    tenthSecond: z.iso.time({ precision: 1 }).register(zf.time.registry, {
      label: "z.iso.time({ precision: 1 })",
    }),
    millisecondsOfDay: z
      .number()
      .int()
      .min(0)
      .max(86_399_999)
      .register(zf.time.registry, {
        label: "z.number() millisecondsOfDay",
        encoding: "millisecondsOfDay",
      }),
  })
  .register(zf.object.registry, {});

// 空の欄に打つところから始める
export const defaultValues: Partial<z.input<typeof schema>> = {};

export type SchemaType = z.infer<typeof schema>;

const harness = [createE2eHarness<typeof schema>({ formId })];

export const Component = () => (
  <AutoForm
    schema={schema}
    defaultValues={defaultValues}
    actionComponents={harness}
  />
);
