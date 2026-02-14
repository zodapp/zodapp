import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconShieldCheck } from "@tabler/icons-react";

export const formId = "refineValidation";
export const title = "カスタムバリデーション";
export const description =
  "refineを使ったパスワード一致などのカスタムバリデーション";
export const icon = IconShieldCheck;
export const category = "Advanced";

export const schema = z
  .object({
    username: zf
      .string()
      .min(3, "ユーザー名は3文字以上必要です")
      .register(zf.string.registry, { label: "ユーザー名", uiType: "text" }),
    email: z
      .email("有効なメールアドレスを入力してください")
      .register(zf.string.registry, {
        label: "メールアドレス",
        uiType: "email",
      }),
    password: zf
      .string()
      .min(8, "パスワードは8文字以上必要です")
      .register(zf.string.registry, {
        label: "パスワード",
        uiType: "password",
      }),
    confirmPassword: zf.string().register(zf.string.registry, {
      label: "パスワード（確認）",
      uiType: "password",
    }),
    message: zfReact
      .message()
      .register(zfReact.message.registry, {
        content:
          "refineを使用すると、複数フィールドにまたがるカスタムバリデーション（パスワード一致確認など）を実装できます。whenオプションでバリデーション条件の指定も可能です。",
      })
      .optional(),
  })
  .register(zf.object.registry, {})
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "パスワードが一致しません",
    when({ value }: { value: unknown }) {
      const _value = value as { confirmPassword?: string };
      return !!_value?.confirmPassword;
    },
  });

export const defaultValues: z.input<typeof schema> = {
  username: "yamada_taro",
  email: "taro@example.com",
  password: "password123",
  confirmPassword: "password123",
};

export type SchemaType = z.infer<typeof schema>;
