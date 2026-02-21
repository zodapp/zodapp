import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconForms } from "@tabler/icons-react";

export const formId = "reactiveBasicInput";
export const title = "基本 (Reactive)";
export const description =
  "reactiveComponentLibrary による基本入力。フィールド単位の確認UIあり。";
export const icon = IconForms;
export const category = "Reactive";
export const reactive = true;

export const schema = z
  .object({
    firstName: zf
      .string()
      .register(zf.string.registry, { label: "名(string)", uiType: "text" })
      .optional(),
    lastName: zf.string().min(1).register(zf.string.registry, {
      label: "姓（string, 必須）",
      uiType: "text",
    }),
    frequency: zf.number().max(7).min(0).register(zf.number.registry, {
      label: "1週間にお酒を飲む日数(number, slider)",
      uiType: "slider",
    }),
    age: zf
      .number()
      .max(150)
      .min(0)
      .register(zf.number.registry, { label: "年齢(number)" }),
    birthday: zf.date().register(zf.date.registry, { label: "誕生日(date)" }),
    isMember: zf
      .boolean()
      .register(zf.boolean.registry, { label: "会員(boolean)" }),
    favoriteColor: zf
      .literal("red")
      .register(zf.literal.registry, { label: "固定データ(literal)" }),
    isConfirmed: zf
      .literal(true, "承認してください")
      .register(zf.boolean.registry, {
        label: "承認済(literal型+booleanコンポーネントを強制)",
      }),
    message: zfReact
      .derived()
      .register(zf.derived.registry, {
        compute: () => "これはReactive版の基本入力フォームサンプルです",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  firstName: "太郎",
  lastName: "山田",
  frequency: 3,
  age: 25,
  birthday: new Date("1999-01-01"),
  isMember: true,
  favoriteColor: "red",
  isConfirmed: undefined as unknown as true,
};

export type SchemaType = z.infer<typeof schema>;
