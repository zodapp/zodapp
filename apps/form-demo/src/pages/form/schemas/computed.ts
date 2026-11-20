import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconCalculator } from "@tabler/icons-react";

export const formId = "computed";
export const title = "zf.computed";
export const description = msgKey(
  "formDemo.page.computed.description" /* i18n: 他の項目の値から計算した結果を表示する */,
);
export const icon = IconCalculator;
export const category = "Advanced";

export const schema = z.object({
  unitPrice: zf
    .number()
    .min(0)
    .register(zf.number.registry, {
      label: msgKey("formDemo.computed.unitPrice" /* i18n: 単価（円） */),
    }),
  quantity: zf
    .number()
    .min(0)
    .register(zf.number.registry, {
      label: msgKey("formDemo.computed.quantity" /* i18n: 数量 */),
    }),
  total: zfReact.computed().register(zf.computed.registry, {
    label: msgKey("formDemo.computed.total" /* i18n: 合計金額 */),
    dependsOnParent: true,
    compute: ({ parent }) => {
      const unitPrice = parent?.unitPrice ?? 0;
      const quantity = parent?.quantity ?? 0;
      return `¥${(unitPrice * quantity).toLocaleString()}`;
    },
  }),
  other: z
    .object({
      unitPrice: zf
        .number()
        .min(0)
        .register(zf.number.registry, {
          label: msgKey(
            "formDemo.computed.other.unitPrice" /* i18n: 単価（円） */,
          ),
        }),
      quantity: zf
        .number()
        .min(0)
        .register(zf.number.registry, {
          label: msgKey("formDemo.computed.other.quantity" /* i18n: 数量 */),
        }),
      total: zfReact.computed().register(zf.computed.registry, {
        label: msgKey("formDemo.computed.other.total" /* i18n: 合計金額 */),
        dependsOnParent: true,
        compute: ({ parent }) => {
          const unitPrice = parent?.unitPrice ?? 0;
          const quantity = parent?.quantity ?? 0;
          return `¥${(unitPrice * quantity).toLocaleString()}`;
        },
      }),
    })
    .register(zf.object.registry, {
      label: msgKey("formDemo.computed.other" /* i18n: 入れ子の場合 */),
      uiType: "box",
    }),
});

export const defaultValues: z.input<typeof schema> = {
  unitPrice: 1000,
  quantity: 3,
  other: {
    unitPrice: 1000,
    quantity: 3,
  },
};

export type SchemaType = z.infer<typeof schema>;
