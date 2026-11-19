import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { msgKey } from "@zodapp/i18n-messages";
import { IconLanguage } from "@tabler/icons-react";
import "../../../messages/types";

export const formId = "i18nMessages";
export const title = "i18n-messages";
export const description =
  "meta の文言と zod のエラーを辞書のキーで書く。ヘッダーで言語を切り替えると、ラベル・選択肢・エラー・日付の表示が変わる";
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
          "formDemo.i18n.nameTooShort" /* ${length}文字以上で入力してください。 */,
          {
            length: 3,
          },
        ),
      )
      .register(zf.string.registry, {
        label: msgKey("formDemo.i18n.name" /* 名前 */),
      }),
    // schema にエラーの文言を書かなければ、zod の既定のエラー（zod.*）を辞書で訳す
    email: z.email().register(zf.string.registry, {
      label: msgKey("formDemo.i18n.email" /* メールアドレス */),
    }),
    color: zf
      .enum([
        zf.literal("red").register(zf.literal.registry, {
          label: msgKey("formDemo.i18n.color.red" /* 赤 */),
        }),
        zf.literal("green").register(zf.literal.registry, {
          label: msgKey("formDemo.i18n.color.green" /* 緑 */),
        }),
        zf.literal("blue").register(zf.literal.registry, {
          label: msgKey("formDemo.i18n.color.blue" /* 青 */),
        }),
      ])
      .register(zf.enum.registry, {
        label: msgKey("formDemo.i18n.color" /* 好きな色 */),
      }),
    contact: zf
      .union([
        z.email().register(zf.string.registry, {
          label: msgKey("formDemo.i18n.contact.email" /* メール */),
        }),
        zf
          .object({
            phone: zf
              .string()
              .min(10)
              .register(zf.string.registry, {
                label: msgKey("formDemo.i18n.phone" /* 電話番号 */),
              }),
          })
          .register(zf.object.registry, {
            label: msgKey("formDemo.i18n.contact.phone" /* 電話 */),
          }),
      ])
      .register(zf.union.registry, {
        label: msgKey("formDemo.i18n.contact" /* 連絡方法 */),
        selectorLabel: msgKey(
          "formDemo.i18n.contact.selector" /* 連絡の手段 */,
        ),
      }),
    birthday: z.iso
      .date()
      .register(zf.date.registry, {
        label: msgKey("formDemo.i18n.birthday" /* 誕生日 */),
      })
      .optional(),
    note: zf
      .string()
      .max(20)
      .register(zf.string.registry, {
        label: msgKey("formDemo.i18n.note" /* メモ */),
      })
      .optional(),
    message: zfReact
      .computed()
      .register(zf.computed.registry, {
        compute: () =>
          "ラベル・選択肢・エラーは辞書のキーで書いています。ヘッダーで English に切り替えると、英語の辞書で表示します（アプリの見出しや説明は日本語のままです）。送信すると、名前（params 付きのキー）とメールアドレス（zod の既定のエラー）のエラーが出ます。",
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  name: "ab",
  email: "not-an-email",
  color: "red",
  contact: "taro@example.com",
};
