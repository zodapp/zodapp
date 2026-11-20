import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconGitBranch } from "@tabler/icons-react";

export const formId = "discriminatedUnionAsTopLevel";
export const title = msgKey(
  "formDemo.page.discriminatedUnionAsTopLevel.title" /* i18n: z.discriminatedUnion（トップレベル） */,
);
export const description = msgKey(
  "formDemo.page.discriminatedUnionAsTopLevel.description" /* i18n: discriminated keyを使ったUnionをトップレベルスキーマとして直接使用する例 */,
);
export const icon = IconGitBranch;
export const category = "Advanced";

export const schema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z
          .literal("email")
          .register(zf.literal.registry, { hidden: true }),
        email: z
          .email(
            msgKey(
              "formDemo.discriminatedUnionAsTopLevel.email.email.email" /* i18n: 有効なメールアドレスを入力してください */,
            ),
          )
          .register(zf.string.registry, {
            label: msgKey(
              "formDemo.discriminatedUnionAsTopLevel.email.email" /* i18n: メール */,
            ),
          }),
        note: zf.string().register(zf.string.registry, {
          label: msgKey(
            "formDemo.discriminatedUnionAsTopLevel.email.note" /* i18n: 備考 */,
          ),
          uiType: "multiline",
        }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.discriminatedUnionAsTopLevel.email" /* i18n: メール連絡 */,
        ),
      }),
    z
      .object({
        type: z
          .literal("phone")
          .register(zf.literal.registry, { hidden: true }),
        phoneType: zf
          .enum([
            zf.literal("mobile").register(zf.literal.registry, {
              label: msgKey(
                "formDemo.discriminatedUnionAsTopLevel.phone.phoneType.mobile" /* i18n: 携帯電話 */,
              ),
            }),
            zf.literal("landline").register(zf.literal.registry, {
              label: msgKey(
                "formDemo.discriminatedUnionAsTopLevel.phone.phoneType.landline" /* i18n: 固定電話 */,
              ),
            }),
          ])
          .register(zf.enum.registry, {
            label: msgKey(
              "formDemo.discriminatedUnionAsTopLevel.phone.phoneType" /* i18n: 電話番号タイプ */,
            ),
          }),
        phone: zf
          .string()
          .min(10)
          .max(15)
          .register(zf.string.registry, {
            label: msgKey(
              "formDemo.discriminatedUnionAsTopLevel.phone.phone" /* i18n: 電話番号 */,
            ),
          }),
        note: zf.string().register(zf.string.registry, {
          label: msgKey(
            "formDemo.discriminatedUnionAsTopLevel.phone.note" /* i18n: 備考 */,
          ),
          uiType: "multiline",
        }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.discriminatedUnionAsTopLevel.phone" /* i18n: 電話連絡 */,
        ),
      }),
  ])
  .register(zf.union.registry, {
    label: msgKey(
      "formDemo.discriminatedUnionAsTopLevel.root" /* i18n: 連絡先 */,
    ),
    selectorLabel: msgKey(
      "formDemo.discriminatedUnionAsTopLevel.selectorLabel" /* i18n: 連絡先タイプ */,
    ),
  });

export const defaultValues: z.input<typeof schema> = {
  type: "email",
  email: "du-toplevel@example.com",
  note: "",
};

export type SchemaType = z.infer<typeof schema>;
