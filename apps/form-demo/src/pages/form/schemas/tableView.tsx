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
  "表での computed（行の値から計算）と dynamic のセル、string の選択式のラベル、valueAction、externalKey、日付・時刻の表示。見出しを押すと、列の種類ごとの基準で並べる（dynamic の列は並べ替えない）。選択肢に無い値のセルも出す";
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
    // 並べ替えは選択肢を定義した順（未着手・対応中・完了）。選択肢に無い値は「（不正な値）」と出し、最後に並ぶ
    status: zf
      .enum([
        zf.literal("todo").register(zf.literal.registry, { label: "未着手" }),
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
      externalKeyConfig: { type: "mock", topic: "users" },
    }),
    due: z.iso.date().register(zf.date.registry, { label: "期限" }),
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
    // computed は計算した値で並べる（ここでは文字の値なので文字の順）
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
    assignee: "u-001",
    due: "2026-04-10",
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
    assignee: "u-002",
    due: "2026-04-01",
    start: 780,
    unitPrice: 500,
    quantity: 10,
    currency: "USD",
    amount: 4999,
  },
  {
    id: "r3",
    office: "closed-branch",
    status: "todo",
    assignee: "u-003",
    due: "2026-04-20",
    start: 1335,
    unitPrice: 80,
    quantity: 25,
    currency: "JPY",
    amount: 2000,
  },
  // r4 は、状態と担当に選択肢に無い値を持つ
  {
    id: "r4",
    office: "hq",
    status: "archived",
    assignee: "u-999",
    due: "2026-04-05",
    start: 600,
    unitPrice: 10000,
    quantity: 1,
    currency: "USD",
    amount: 100,
  },
] as unknown as Row[];

export const Component = () => (
  <Stack>
    <Text size="sm" c="dimmed">
      「拠点」は suggestions
      のラベルで表示し、選択肢に無い値はそのまま出します。「状態」「担当」の選択肢に無い値は「（不正な値）」と出します。「金額」は行の通貨で表示が変わります。見出しを押すと並べ替え、押すたびに昇順・降順が切り替わります（「金額」は並べ替えません）。
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
