import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconCalculator } from "@tabler/icons-react";

export const formId = "computed";
export const title = "Computed";
export const description = "他のフィールドの値から計算結果を表示するサンプル";
export const icon = IconCalculator;
export const category = "Advanced";

export const schema = z.object({
  unitPrice: zf
    .number()
    .min(0)
    .register(zf.number.registry, { label: "単価（円）" }),
  quantity: zf.number().min(0).register(zf.number.registry, { label: "数量" }),
  total: zfReact
    .computed()
    .register(zfReact.computed.registry, {
      label: "合計金額",
      compute: (parent) => {
        const unitPrice = parent?.unitPrice ?? 0;
        const quantity = parent?.quantity ?? 0;
        return `¥${(unitPrice * quantity).toLocaleString()}`;
      },
    })
    .optional(),
  other: z
    .object({
      unitPrice: zf
        .number()
        .min(0)
        .register(zf.number.registry, { label: "単価（円）" }),
      quantity: zf
        .number()
        .min(0)
        .register(zf.number.registry, { label: "数量" }),
      total: zfReact
        .computed()
        .register(zfReact.computed.registry, {
          label: "合計金額",
          compute: (parent) => {
            const unitPrice = parent?.unitPrice ?? 0;
            const quantity = parent?.quantity ?? 0;
            return `¥${(unitPrice * quantity).toLocaleString()}`;
          },
        })
        .optional(),
    })
    .register(zf.object.registry, { label: "入れ子の場合", uiType: "box" }),
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
