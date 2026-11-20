import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-parsed-submit";
export const title = msgKey(
  "formDemo.page.e2eParsedSubmit.title" /* i18n: e2e：送信する値の変換 */,
);
export const description = msgKey(
  "formDemo.page.e2eParsedSubmit.description" /* i18n: onSubmit には parse した値（z.output）が渡る。名前は前後の空白を外し、コードは大文字にし、数（codec）は数にし、同意（stringbool）は true / false にし、略称は 3 文字未満なら n/a にする。役割（default）とニックネーム（prefault）は、開くときに既定値で補い、開いただけでは isDirty は false */,
);
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    // .trim()：入力はそのまま、送信では前後の空白を外す
    name: z
      .string()
      .trim()
      .register(zf.string.registry, {
        label: msgKey("formDemo.e2eParsedSubmit.name" /* i18n: 名前（trim） */),
      }),
    // .default()：値が無ければ、開くときに既定値で補う
    role: z
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2eParsedSubmit.role" /* i18n: 役割（default） */,
        ),
      })
      .default("member"),
    // .prefault()：値が無ければ、開くときに prefault の値で補う
    nickname: z
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2eParsedSubmit.nickname" /* i18n: ニックネーム（prefault） */,
        ),
      })
      .prefault("guest"),
    // z.coerce.number()：数の欄
    count: z.coerce.number().register(zf.common.registry, {
      label: msgKey(
        "formDemo.e2eParsedSubmit.count" /* i18n: 個数（coerce） */,
      ),
    }),
    // .pipe()：入口の string で描き、送信では大文字にする
    code: z
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2eParsedSubmit.code" /* i18n: コード（pipe で大文字） */,
        ),
      })
      .pipe(z.transform((text: string) => text.toUpperCase())),
    // z.codec()：入口の string で描き、送信では数にする
    amount: z.codec(
      z.string().register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2eParsedSubmit.amount" /* i18n: 数（codec） */,
        ),
      }),
      z.number(),
      {
        decode: (text) => Number(text),
        encode: (value) => String(value),
      },
    ),
    // z.stringbool()：文字列の欄。送信では true / false にする
    agree: z.stringbool().register(zf.common.registry, {
      label: msgKey(
        "formDemo.e2eParsedSubmit.agree" /* i18n: 同意（stringbool） */,
      ),
    }),
    // .catch()：検証に落ちる値は、送信で catch の値にする
    shortName: z
      .string()
      .min(3)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2eParsedSubmit.shortName" /* i18n: 略称（catch） */,
        ),
      })
      .catch("n/a"),
  })
  .register(zf.object.registry, {});

// role・nickname は値を入れず、開くときに補われるのを見る
export const defaultValues = {
  name: "",
  count: 0,
  code: "",
  amount: "",
  agree: "",
  shortName: "",
} as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
