import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconSitemap } from "@tabler/icons-react";

export const formId = "nestedObject";
export const title = "ネストしたスキーマ";
export const description = "通常フィールドとネストしたオブジェクトの組み合わせ";
export const icon = IconSitemap;
export const category = "Advanced";

// ネストされた住所スキーマ
const addressSchema = z
  .object({
    postalCode: zf
      .string()
      .register(zf.string.registry, { label: "郵便番号", uiType: "text" }),
    prefecture: zf
      .string()
      .register(zf.string.registry, { label: "都道府県", uiType: "text" }),
    city: zf
      .string()
      .register(zf.string.registry, { label: "市区町村", uiType: "text" }),
    street: zf
      .string()
      .register(zf.string.registry, { label: "番地", uiType: "text" })
      .optional(),
  })
  .register(zf.object.registry, { label: "住所", uiType: "box" });

// ネストされた緊急連絡先スキーマ
const emergencyContactSchema = z
  .object({
    name: zf
      .string()
      .register(zf.string.registry, { label: "氏名", uiType: "text" }),
    phone: zf
      .string()
      .register(zf.string.registry, { label: "電話番号", uiType: "tel" }),
    relationship: zf
      .string()
      .register(zf.string.registry, { label: "続柄", uiType: "text" }),
  })
  .register(zf.object.registry, { label: "緊急連絡先", uiType: "box" });

export const schema = z
  .object({
    // 通常のフィールド（ルートレベル）
    fullName: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "氏名", uiType: "text" }),
    email: z
      .email("有効なメールアドレスを入力してください")
      .register(zf.string.registry, {
        label: "メールアドレス",
        uiType: "email",
      }),
    phone: zf
      .string()
      .register(zf.string.registry, { label: "電話番号", uiType: "tel" })
      .optional(),

    // ネストしたオブジェクト
    address: addressSchema,
    emergencyContact: emergencyContactSchema,

    message: zfReact
      .message()
      .register(zfReact.message.registry, {
        content: "ネストしたオブジェクトをそのままフォームとして表現できます。",
      })
      .optional(),
  })
  .register(zf.object.registry, { uiType: "box", label: "会員" });

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
