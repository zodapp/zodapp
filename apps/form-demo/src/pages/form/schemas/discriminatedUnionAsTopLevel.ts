import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconGitBranch } from "@tabler/icons-react";

export const formId = "discriminatedUnionAsTopLevel";
export const title = "Discriminated Union (Top-level)";
export const description =
  "discriminated keyを使ったUnionをトップレベルスキーマとして直接使用する例";
export const icon = IconGitBranch;
export const category = "Advanced";

export const schema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z
          .literal("email")
          .register(zf.literal.registry, { hidden: true }),
        email: z
          .email("有効なメールアドレスを入力してください")
          .register(zf.string.registry, { label: "メール" }),
        note: zf
          .string()
          .register(zf.string.registry, { label: "備考", uiType: "multiline" }),
      })
      .register(zf.object.registry, { label: "メール連絡" }),
    z
      .object({
        type: z
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
        note: zf
          .string()
          .register(zf.string.registry, { label: "備考", uiType: "multiline" }),
      })
      .register(zf.object.registry, { label: "電話連絡" }),
  ])
  .register(zf.union.registry, {
    label: "連絡先",
    selectorLabel: "連絡先タイプ",
  });

export const defaultValues: z.input<typeof schema> = {
  type: "email",
  email: "du-toplevel@example.com",
  note: "",
};

export type SchemaType = z.infer<typeof schema>;
