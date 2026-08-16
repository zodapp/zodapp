import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { ValidatePrecedingFieldsProvider } from "@zodapp/zod-form-react";
import { IconListCheck } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";

export const formId = "validatePreceding";
export const title = "前方フィールドの一括検証";
export const description =
  "ValidatePrecedingFieldsProvider により、後方のフィールドへフォーカスした時点でそれより前の未入力フィールドをまとめて検証する";
export const icon = IconListCheck;
export const category = "Advanced";

// 上から順に入力させたい申込フォームの例。
// 途中を飛ばして下のフィールドにフォーカスすると、
// 飛ばした必須フィールドに即座にエラーが表示される。
export const schema = z
  .object({
    name: zf
      .string()
      .min(1, "氏名を入力してください")
      .register(zf.string.registry, { label: "氏名（必須）" }),
    email: zf
      .string()
      .min(1, "メールアドレスを入力してください")
      .register(zf.string.registry, {
        label: "メールアドレス（必須）",
        uiType: "email",
      }),
    tel: zf
      .string()
      .min(1, "電話番号を入力してください")
      .register(zf.string.registry, {
        label: "電話番号（必須）",
        uiType: "tel",
      }),
    note: zf
      .string()
      .register(zf.string.registry, {
        label: "備考（任意）",
        uiType: "multiline",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  name: "",
  email: "",
  tel: "",
};

export const Component = () => (
  <ValidatePrecedingFieldsProvider>
    <AutoForm schema={schema} defaultValues={defaultValues} showPreview />
  </ValidatePrecedingFieldsProvider>
);

export type SchemaType = z.infer<typeof schema>;
