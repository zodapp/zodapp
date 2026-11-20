import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { msgKey } from "@zodapp/i18n-messages";
import { IconLanguage } from "@tabler/icons-react";
import "../../../messages/types";

export const formId = "i18nMessages";
export const title = "i18n-messages";
export const description = msgKey(
  "formDemo.page.i18nMessages.description" /* i18n: meta の文言と zod のエラーを辞書のキーで書く。ヘッダーで言語を切り替えると、ラベル・選択肢・エラー・日付の表示が変わる */,
);
export const icon = IconLanguage;
export const category = "Advanced";

// meta の文言は msgKey で辞書のキーにする（form-demo の src/messages に ja・en を置く）。
// キーの直後のコメントは、ESLint（@zodapp/i18n-messages/comment）が日本語の辞書から書き込む
export const schema = z
  .object({
    name: zf
      .string()
      // params 付きのキー。辞書の関数に { length: "3" } が渡る
      .min(
        3,
        msgKey(
          "formDemo.i18nMessages.nameTooShort" /* i18n: ${length}文字以上で入力してください。 */,
          {
            length: 3,
          },
        ),
      )
      .register(zf.string.registry, {
        label: msgKey("formDemo.i18nMessages.name" /* i18n: 名前 */),
      }),
    // schema にエラーの文言を書かなければ、zod の既定のエラー（zod.*）を辞書で訳す
    email: z.email().register(zf.string.registry, {
      label: msgKey("formDemo.i18nMessages.email" /* i18n: メールアドレス */),
    }),
    color: zf
      .enum([
        zf.literal("red").register(zf.literal.registry, {
          label: msgKey("formDemo.i18nMessages.color.red" /* i18n: 赤 */),
        }),
        zf.literal("green").register(zf.literal.registry, {
          label: msgKey("formDemo.i18nMessages.color.green" /* i18n: 緑 */),
        }),
        zf.literal("blue").register(zf.literal.registry, {
          label: msgKey("formDemo.i18nMessages.color.blue" /* i18n: 青 */),
        }),
      ])
      .register(zf.enum.registry, {
        label: msgKey("formDemo.i18nMessages.color" /* i18n: 好きな色 */),
      }),
    contact: zf
      .union([
        z.email().register(zf.string.registry, {
          label: msgKey(
            "formDemo.i18nMessages.contact.email" /* i18n: メール */,
          ),
        }),
        zf
          .object({
            phone: zf
              .string()
              .min(10)
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.i18nMessages.phone" /* i18n: 電話番号 */,
                ),
              }),
          })
          .register(zf.object.registry, {
            label: msgKey(
              "formDemo.i18nMessages.contact.phone" /* i18n: 電話 */,
            ),
          }),
      ])
      .register(zf.union.registry, {
        label: msgKey("formDemo.i18nMessages.contact" /* i18n: 連絡方法 */),
        selectorLabel: msgKey(
          "formDemo.i18nMessages.contact.selector" /* i18n: 連絡の手段 */,
        ),
      }),
    birthday: z.iso
      .date()
      .register(zf.date.registry, {
        label: msgKey("formDemo.i18nMessages.birthday" /* i18n: 誕生日 */),
      })
      .optional(),
    note: zf
      .string()
      .max(20)
      .register(zf.string.registry, {
        label: msgKey("formDemo.i18nMessages.note" /* i18n: メモ */),
      })
      .optional(),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.i18nMessages.message.compute" /* i18n: ラベル・選択肢・エラーは辞書のキーで書いています。ヘッダーで English に切り替えると、英語の辞書で表示します。送信すると、名前（params 付きのキー）とメールアドレス（zod の既定のエラー）のエラーが出ます。 */,
        ),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  name: "ab",
  email: "not-an-email",
  color: "red",
  contact: "taro@example.com",
};
