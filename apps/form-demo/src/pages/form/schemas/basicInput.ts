import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconForms } from "@tabler/icons-react";

export const formId = "basicInput";
export const title = msgKey("formDemo.page.basicInput.title" /* i18n: 基本 */);
export const description = msgKey(
  "formDemo.page.basicInput.description" /* i18n: 文字列、数値、真偽値、日付、BigIntの基本的な入力 */,
);
export const icon = IconForms;
export const category = "Basic";

export const schema = z
  .object({
    firstName: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey("formDemo.basicInput.firstName" /* i18n: 名(string) */),
        uiType: "text",
      })
      .optional(),
    lastName: zf
      .string()
      .min(1)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.basicInput.lastName" /* i18n: 姓（string, 必須） */,
        ),
        uiType: "text",
      }),
    frequency: zf
      .number()
      .max(7)
      .min(0)
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.basicInput.frequency" /* i18n: 1週間にお酒を飲む日数(number, slider) */,
        ),
        uiType: "slider",
      }),
    age: zf
      .number()
      .max(150)
      .min(0)
      .register(zf.number.registry, {
        label: msgKey("formDemo.basicInput.age" /* i18n: 年齢(number) */),
      }),
    birthday: zf.date().register(zf.date.registry, {
      label: msgKey("formDemo.basicInput.birthday" /* i18n: 誕生日(date) */),
    }),
    isMember: zf.boolean().register(zf.boolean.registry, {
      label: msgKey("formDemo.basicInput.isMember" /* i18n: 会員(boolean) */),
    }),
    bigAmount: zf
      .bigint()
      .register(zf.bigint.registry, { label: "bigint" })
      .optional(),
    favoriteColor: zf.literal("red").register(zf.literal.registry, {
      label: msgKey(
        "formDemo.basicInput.favoriteColor" /* i18n: 固定データ(literal) */,
      ),
    }),
    isConfirmed: zf
      .literal(
        true,
        msgKey(
          "formDemo.basicInput.isConfirmed.literal" /* i18n: 承認してください */,
        ),
      )
      .register(zf.boolean.registry, {
        label: msgKey(
          "formDemo.basicInput.isConfirmed" /* i18n: 承認済(literal型+booleanコンポーネントを強制) */,
        ),
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
      .register(zf.tuple.registry, {
        label: msgKey("formDemo.basicInput.position" /* i18n: 座標(tuple) */),
      }),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.basicInput.message.compute" /* i18n: これは基本入力フォームのサンプルです */,
        ),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  firstName: "John",
  lastName: "Smith",
  frequency: 3,
  age: 25,
  birthday: new Date("1999-01-01"),
  isMember: true,
  bigAmount: 1234567890123456789n,
  favoriteColor: "red",
  isConfirmed: undefined as unknown as true,
  position: [50, 50],
};

export type SchemaType = z.infer<typeof schema>;
