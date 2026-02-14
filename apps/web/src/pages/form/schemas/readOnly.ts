import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconForms } from "@tabler/icons-react";

export const formId = "readOnly";
export const title = "readOnly";
export const description = "readOnlyモード";
export const icon = IconForms;
export const category = "Standard";

// enum用のリテラル定義
const hobbyLiterals = [
  z
    .literal("reading")
    .register(zf.literal.registry, { label: "読書", color: "blue.6" }),
  z
    .literal("sports")
    .register(zf.literal.registry, { label: "スポーツ", color: "green.6" }),
  z
    .literal("music")
    .register(zf.literal.registry, { label: "音楽", color: "red.6" }),
  z
    .literal("gaming")
    .register(zf.literal.registry, { label: "ゲーム", color: "grape.6" }),
] as const;

type Hobby = z.output<(typeof hobbyLiterals)[number]>;

// discriminatedUnion用のスキーマ定義
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
      })
      .register(zf.object.registry, { label: "メール連絡" }),
    z
      .object({
        type: z
          .literal("phone")
          .register(zf.literal.registry, { hidden: true }),
        phone: zf
          .string()
          .min(10)
          .max(15)
          .register(zf.string.registry, { label: "電話番号" }),
      })
      .register(zf.object.registry, { label: "電話連絡" }),
  ])
  .register(zf.union.registry, {
    label: "連絡先",
    selectorLabel: "連絡先タイプ",
  });

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
    bigAmount: zf
      .bigint()
      .register(zf.bigint.registry, { label: "bigint" })
      .optional(),
    favoriteColor: zf
      .literal("red")
      .register(zf.literal.registry, { label: "固定データ(literal)" }),
    isConfirmed: zf
      .literal(true, "承認してください")
      .register(zf.boolean.registry, {
        label: "承認済(literal型+booleanコンポーネントを強制)",
      }),
    position: zf
      .tuple([
        zf
          .number()
          .min(0)
          .max(100)
          .register(zf.number.registry, { label: "X" }),
        zf
          .number()
          .min(0)
          .max(100)
          .register(zf.number.registry, { label: "Y" }),
      ])
      .register(zf.tuple.registry, { label: "座標(tuple)" }),
    // enum: 単一選択
    favoriteHobby: zf
      .enum(hobbyLiterals)
      .register(zf.enum.registry, { label: "一番好きな趣味(enum)" }),
    // enum: 複数選択
    hobbies: zf.array(zf.enum(hobbyLiterals)).register(zf.array.registry, {
      label: "趣味(array enum)",
      uiType: "multipleEnum",
    }),
    // discriminatedUnion
    contact: contactSchema,
    message: zfReact
      .message()
      .register(zfReact.message.registry, {
        content: "これはreadOnlyモードのサンプルです",
      })
      .optional(),
  })
  .register(zf.object.registry, { readOnly: true });

export const defaultValues: z.input<typeof schema> = {
  firstName: "太郎",
  lastName: "山田",
  frequency: 3,
  age: 25,
  birthday: new Date("1999-01-01"),
  isMember: true,
  bigAmount: 1234567890123456789n,
  favoriteColor: "red",
  isConfirmed: undefined as unknown as true,
  position: [50, 50],
  favoriteHobby: "reading",
  hobbies: ["reading", "music"],
  contact: {
    type: "email",
    email: "test@example.com",
  },
};

export type SchemaType = z.infer<typeof schema>;
