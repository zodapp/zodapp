import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconGitBranch } from "@tabler/icons-react";

export const formId = "discriminatedUnion";
export const title = "Discriminated Union";
export const description = "discriminated keyを使った安定したUnion";
export const icon = IconGitBranch;
export const category = "Standard";

const contactSchema = z
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

// 判別子（type）の無い古い形のデータに type を補う。
// 描画では preprocess を外して中の union を描き、値は先にこの変換を通して中の形にそろえる
const fillContactType = (value: unknown) => {
  if (value && typeof value === "object" && !("type" in value)) {
    return { ...value, type: "email" in value ? "email" : "phone" };
  }
  return value;
};

const legacyContactSchema = z.preprocess(
  fillContactType,
  z
    .discriminatedUnion("type", contactSchema.options)
    .register(zf.union.registry, {
      label:
        "連絡先（z.preprocess で包んだ union。初期値は type の無い古い形）",
      selectorLabel: "連絡先タイプ",
    }),
);

export const schema = z
  .object({
    contact: contactSchema,
    legacyContact: legacyContactSchema,
    message: zfReact
      .computed()
      .register(zf.computed.registry, {
        compute: () =>
          "Discriminated Unionは、識別子（type）によって型を判別します。通常のUnionよりパフォーマンスやメンテナンス性に優れています。",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  contact: {
    type: "email",
    email: "du@example.com",
    note: "",
  },
  // type の無い古い形。開くと preprocess で type: "email" が補われた形で表示される
  legacyContact: { email: "legacy@example.com", note: "" },
};

export type SchemaType = z.infer<typeof schema>;
