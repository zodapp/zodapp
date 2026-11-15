import { z } from "zod";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  defineDynamicMeta,
  zf,
} from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { AutoTable } from "@zodapp/zod-form-widget/table";
import { Stack, Text } from "@mantine/core";
import { IconTestPipe } from "@tabler/icons-react";

import { users } from "../../../../shared/demo/resolvers";
import { withFetchLog } from "../../../../shared/demo/formDemoLog";

export const formId = "e2e-table";
export const title = "e2e：表";
export const description =
  "数・日付・select・externalKey・computed・dynamic の列を持つ表。見出しを押すと、列の種類ごとの基準で並べる（dynamic の列は並べ替えない）。金額は行の通貨で表示が変わる。選択肢に無い値のセルも出す";
export const icon = IconTestPipe;
export const category = "e2e";

type Currency = "JPY" | "USD";

const externalKeyResolvers = withFetchLog([
  createMockExternalKeyResolver({ topics: { users: createMockTopic(users) } }),
]);

// 金額：行の通貨で表示が変わる dynamic のセル
const amountSchema = z.number().register(
  zf.dynamic.registry,
  defineDynamicMeta<number, { currency?: Currency }>({
    label: "金額",
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
    quantity: zf
      .number()
      .register(zf.number.registry, { label: "数量", width: 70 }),
    due: z.iso.date().register(zf.date.registry, { label: "期限" }),
    status: zf
      .enum([
        zf.literal("todo").register(zf.literal.registry, { label: "未着手" }),
        zf.literal("doing").register(zf.literal.registry, { label: "対応中" }),
        zf.literal("done").register(zf.literal.registry, { label: "完了" }),
      ])
      .register(zf.enum.registry, { label: "状態" }),
    assignee: zf.string().register(zf.externalKey.registry, {
      label: "担当",
      externalKeyConfig: { type: "mock", topic: "users" },
    }),
    total: zfReact
      .computed()
      .register(zf.computed.registry, {
        label: "小計",
        dependsOnParent: true,
        compute: ({ parent }: { parent: { quantity: number } }) =>
          `${parent.quantity * 100}`,
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

// t4 は、状態と担当に選択肢に無い値を持つ
const rows = [
  {
    id: "t1",
    quantity: 3,
    due: "2026-04-10",
    status: "done",
    assignee: "u-002",
    currency: "JPY",
    amount: 3600,
  },
  {
    id: "t2",
    quantity: 12,
    due: "2026-04-01",
    status: "todo",
    assignee: "u-003",
    currency: "USD",
    amount: 4999,
  },
  {
    id: "t3",
    quantity: 7,
    due: "2026-04-20",
    status: "doing",
    assignee: "u-001",
    currency: "JPY",
    amount: 120,
  },
  {
    id: "t4",
    quantity: 1,
    due: "2026-04-05",
    status: "archived",
    assignee: "u-999",
    currency: "USD",
    amount: 100,
  },
] as unknown as Row[];

export const Component = () => (
  <Stack>
    <Text size="sm" c="dimmed">
      手順：見出しを押して並べ替える。押すたびに昇順・降順が切り替わる
    </Text>
    <AutoTable
      schema={schema}
      data={rows}
      keyField="id"
      externalKeyResolvers={externalKeyResolvers}
    />
  </Stack>
);
