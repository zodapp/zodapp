import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconUsers } from "@tabler/icons-react";

export const formId = "union";
export const title = "Union";
export const description = "Union型を使った複数タイプの連絡先入力";
export const icon = IconUsers;
export const category = "Advanced";

export const schema = z
  .object({
    contact: zf
      .union([
        z
          .email("有効なメールアドレスを入力してください")
          .register(zf.string.registry, { label: "メールアドレス(文字列)" }),
        zf
          .object({
            type: zf
              .literal("phone")
              .register(zf.literal.registry, { hidden: true }),
            phoneType: zf
              .enum([
                zf
                  .literal("mobile")
                  .register(zf.literal.registry, { label: "携帯電話" }),
                zf
                  .literal("landline")
                  .register(zf.literal.registry, { label: "固定電話" }),
              ])
              .register(zf.enum.registry, { label: "電話番号タイプ" }),
            phone: zf
              .string()
              .min(10)
              .max(15)
              .register(zf.string.registry, { label: "電話番号" }),
          })
          .register(zf.object.registry, { label: "電話" }),
        zf
          .object({
            type: zf
              .literal("address")
              .register(zf.literal.registry, { hidden: true }),
            address: zf
              .string()
              .register(zf.string.registry, { label: "住所" }),
          })
          .register(zf.object.registry, { label: "住所" }),
      ])
      .register(zf.union.registry, {
        label: "連絡先",
        selectorLabel: "連絡先タイプ",
      }),
    message: zfReact
      .message()
      .register(zfReact.message.registry, {
        content:
          "Union型では、異なる型の選択肢から1つを選んで入力できます。メール、電話、住所のいずれかを選択してください。",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  contact: "user@example.com",
};

export type SchemaType = z.infer<typeof schema>;
