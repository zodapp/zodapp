import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconShieldCheck } from "@tabler/icons-react";

export const formId = "refineValidation";
export const title = "z.refine";
export const description = msgKey(
  "formDemo.page.refineValidation.description" /* i18n: refineを使ったパスワード一致などのカスタムバリデーション */,
);
export const icon = IconShieldCheck;
export const category = "Advanced";

export const schema = z
  .object({
    username: zf
      .string()
      .min(
        3,
        msgKey(
          "formDemo.refineValidation.username.min" /* i18n: ユーザー名は3文字以上必要です */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.refineValidation.username" /* i18n: ユーザー名 */,
        ),
        uiType: "text",
      }),
    email: z
      .email(
        msgKey(
          "formDemo.refineValidation.email.email" /* i18n: 有効なメールアドレスを入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.refineValidation.email" /* i18n: メールアドレス */,
        ),
        uiType: "email",
      }),
    password: zf
      .string()
      .min(
        8,
        msgKey(
          "formDemo.refineValidation.password.min" /* i18n: パスワードは8文字以上必要です */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.refineValidation.password" /* i18n: パスワード */,
        ),
        uiType: "password",
      }),
    confirmPassword: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.refineValidation.confirmPassword" /* i18n: パスワード（確認） */,
      ),
      uiType: "password",
    }),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.refineValidation.message.compute" /* i18n: refineを使用すると、複数フィールドにまたがるカスタムバリデーション（パスワード一致確認など）を実装できます。whenオプションでバリデーション条件の指定も可能です。 */,
        ),
    }),
  })
  .register(zf.object.registry, {})
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: msgKey(
      "formDemo.refineValidation.refine" /* i18n: パスワードが一致しません */,
    ),
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
