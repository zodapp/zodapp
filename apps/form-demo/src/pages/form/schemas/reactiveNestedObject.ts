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
        "formDemo.reactiveNestedObject.addressSchema.postalCode" /* i18n: 郵便番号 */,
      ),
      uiType: "text",
    }),
    prefecture: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.addressSchema.prefecture" /* i18n: 都道府県 */,
      ),
      uiType: "text",
    }),
    city: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.reactiveNestedObject.addressSchema.city" /* i18n: 市区町村 */,
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
  fullName: "山田 太郎",
  email: "taro@example.com",
  phone: "090-1234-5678",
  address: {
    postalCode: "100-0001",
    prefecture: "東京都",
    city: "千代田区",
    street: "千代田1-1-1",
  },
  emergencyContact: {
    name: "山田 花子",
    phone: "090-8765-4321",
    relationship: "配偶者",
  },
};

export type SchemaType = z.infer<typeof schema>;
