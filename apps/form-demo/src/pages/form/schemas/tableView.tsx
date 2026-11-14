import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { AutoTable } from "@zodapp/zod-form-widget/table";
import { Stack, Text } from "@mantine/core";
import { IconTable } from "@tabler/icons-react";

import {
  demoExternalKeyResolvers,
  demoValueActionResolver,
} from "../../../shared/demo/resolvers";

export const formId = "tableView";
export const title = "表（AutoTable）";
export const description =
  "表での computed（行の値から計算）と dynamic のセル、string の選択式のラベル、valueAction、externalKey、時刻の表示";
export const icon = IconTable;
export const category = "Advanced";

type Currency = "JPY" | "USD";

/**
 * 金額：行の通貨で表示の仕方が変わる dynamic のセル。
 * 表は行の値を TableRowProvider で渡すので、resolve は parent を受け取れる
 */
const amountSchema = z.number().register(
  zf.dynamic.registry,
  defineDynamicMeta<number, { currency?: Currency }>({
    label: "金額（dynamic）",
    dependsOnParent: true,
    resolve: ({ parent }) => {
      const currency = parent?.currency ?? "JPY";
      return {
        key: currency,
        schema: zf.number().register(zf.number.registry, {
          label: "金額",
          formatter: (value) =>
            currency === "JPY"
              ? `¥${value.toLocaleString()}`
              : `$${(value / 100).toFixed(2)}`,
        }),
      };
    },
  }),
);

export const schema = z
  .object({
    id: zf.string().register(zf.string.registry, { label: "ID", width: 70 }),
    office: zf.string().register(zf.string.registry, {
      label: "拠点（select）",
      uiType: "select",
      suggestions: [
        { label: "東京本社", value: "hq" },
        { label: "大阪支社", value: "osaka" },
      ],
      valueAction: {
        getActionParams: ({ value }) => ({
          href: `https://example.com/offices/${value}`,
        }),
      },
    }),
    status: zf
      .enum([
        zf.literal("open").register(zf.literal.registry, { label: "対応中" }),
        zf.literal("done").register(zf.literal.registry, { label: "完了" }),
      ])
      .register(zf.enum.registry, {
        label: "状態（valueAction）",
        valueAction: {
          getActionParams: ({ value }) => ({
            href: `https://example.com/status/${value}`,
          }),
        },
      }),
    assignee: zf.string().register(zf.externalKey.registry, {
      label: "担当（externalKey）",
      externalKeyConfig: { type: "mock", source: "users" },
    }),
    start: z.number().register(zf.time.registry, {
      label: "開始（time）",
      encoding: "minutesOfDay",
      width: 90,
    }),
    unitPrice: zf
      .number()
      .register(zf.number.registry, { label: "単価", width: 80 }),
    quantity: zf
      .number()
      .register(zf.number.registry, { label: "数量", width: 70 }),
    total: zfReact
      .computed()
      .register(zf.computed.registry, {
        label: "小計（computed）",
        dependsOnParent: true,
        compute: ({
          parent,
        }: {
          parent: { unitPrice: number; quantity: number };
        }) => `¥${(parent.unitPrice * parent.quantity).toLocaleString()}`,
      })
      .optional(),
    currency: zf
      .enum([
        zf.literal("JPY").register(zf.literal.registry, { label: "円" }),
        zf.literal("USD").register(zf.literal.registry, { label: "ドル" }),
      ])
      .register(zf.enum.registry, { label: "通貨", width: 70 }),
    amount: amountSchema,
  })
  .register(zf.object.registry, {});

export const defaultValues = {} as z.input<typeof schema>;

type Row = z.infer<typeof schema> & Record<string, unknown>;

const rows = [
  {
    id: "r1",
    office: "hq",
    status: "open",
    assignee: "u-taro",
    start: 570,
    unitPrice: 1200,
    quantity: 3,
    currency: "JPY",
    amount: 3600,
  },
  {
    id: "r2",
    office: "osaka",
    status: "done",
    assignee: "u-sato",
    start: 780,
    unitPrice: 500,
    quantity: 10,
    currency: "USD",
    amount: 4999,
  },
  {
    id: "r3",
    office: "closed-branch",
    status: "open",
    assignee: "u-suzuki",
    start: 1335,
    unitPrice: 80,
    quantity: 25,
    currency: "JPY",
    amount: 2000,
  },
] as unknown as Row[];

export const Component = () => (
  <Stack>
    <Text size="sm" c="dimmed">
      「拠点」は suggestions
      のラベルで表示し、選択肢に無い値はそのまま出します。「金額」は行の通貨で表示が変わります。
    </Text>
    <AutoTable
      schema={schema}
      data={rows}
      keyField="id"
      externalKeyResolvers={demoExternalKeyResolvers}
      valueActionResolver={demoValueActionResolver}
    />
  </Stack>
);
