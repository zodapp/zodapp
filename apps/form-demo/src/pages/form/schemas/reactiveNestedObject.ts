import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconSitemap } from "@tabler/icons-react";

export const formId = "reactiveNestedObject";
export const title = "zf.object (Reactive)";
export const description = msgKey(
  "formDemo.page.reactiveNestedObject.description" /* i18n: reactiveComponentLibrary によるネストオブジェクト。フィールド単位の確認UIあり。 */,
);
export const icon = IconSitemap;
export const category = "Reactive";
export const reactive = true;

const addressSchema = z
  .object({
    postalCode: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.addressSchema.postalCode" /* i18n: ZIP コード */,
      ),
      uiType: "text",
    }),
    prefecture: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.addressSchema.prefecture" /* i18n: 州 */,
      ),
      uiType: "text",
    }),
    city: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.addressSchema.city" /* i18n: 市 */,
      ),
      uiType: "text",
    }),
    street: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveNestedObject.addressSchema.street" /* i18n: 番地 */,
        ),
        uiType: "text",
      })
      .optional(),
  })
  .register(zf.object.registry, {
    label: msgKey(
      "formDemo.reactiveNestedObject.addressSchema" /* i18n: 住所 */,
    ),
    uiType: "box",
  });

const emergencyContactSchema = z
  .object({
    name: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.emergencyContactSchema.name" /* i18n: 氏名 */,
      ),
      uiType: "text",
    }),
    phone: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.emergencyContactSchema.phone" /* i18n: 電話番号 */,
      ),
      uiType: "tel",
    }),
    relationship: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.emergencyContactSchema.relationship" /* i18n: 続柄 */,
      ),
      uiType: "text",
    }),
  })
  .register(zf.object.registry, {
    label: msgKey(
      "formDemo.reactiveNestedObject.emergencyContactSchema" /* i18n: 緊急連絡先 */,
    ),
    uiType: "box",
  });

export const schema = z
  .object({
    fullName: zf
      .string()
      .min(1)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveNestedObject.fullName" /* i18n: 氏名 */,
        ),
        uiType: "text",
      }),
    email: z
      .email(
        msgKey(
          "formDemo.reactiveNestedObject.email.email" /* i18n: 有効なメールアドレスを入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveNestedObject.email" /* i18n: メールアドレス */,
        ),
        uiType: "email",
      }),
    phone: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveNestedObject.phone" /* i18n: 電話番号 */,
        ),
        uiType: "tel",
      })
      .optional(),

    address: addressSchema,
    emergencyContact: emergencyContactSchema,

    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.reactiveNestedObject.message.compute" /* i18n: Reactive版ではネストオブジェクトの各フィールドに確認UIが付きます。 */,
        ),
    }),
  })
  .register(zf.object.registry, {
    uiType: "box",
    label: msgKey("formDemo.reactiveNestedObject.root" /* i18n: 会員 */),
  });

export const defaultValues: z.input<typeof schema> = {
  fullName: "John Smith",
  email: "john@example.com",
  phone: "212-555-0100",
  address: {
    postalCode: "94105",
    prefecture: "California",
    city: "San Francisco",
    street: "1 Market St",
  },
  emergencyContact: {
    name: "Jane Smith",
    phone: "212-555-0199",
    relationship: "Spouse",
  },
};

export type SchemaType = z.infer<typeof schema>;
