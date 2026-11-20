import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-passthrough";
export const title = msgKey(
  "formDemo.page.e2ePassthrough.title" /* i18n: e2e：欄を出さずにそのまま送る型 */,
);
export const description = msgKey(
  "formDemo.page.e2ePassthrough.description" /* i18n: z.any()・z.unknown()・z.custom()・z.symbol()・z.function()・z.never()（optional）・z.nan() は欄を出さず、初期値をそのまま送る。z.templateLiteral() は文字列の欄になり、形に合わないとエラーになる。.nonoptional() は中の欄を描き、空なら送信が止まる */,
);
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    title: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.e2ePassthrough.title" /* i18n: 見出し */),
    }),
    anyValue: z.any().register(zf.common.registry, {
      label: msgKey("formDemo.e2ePassthrough.anyValue" /* i18n: any の値 */),
    }),
    unknownValue: z.unknown().register(zf.common.registry, {
      label: msgKey(
        "formDemo.e2ePassthrough.unknownValue" /* i18n: unknown の値 */,
      ),
    }),
    customValue: z
      .custom<{
        id: number;
      }>(
        (value) =>
          typeof value === "object" &&
          value !== null &&
          typeof (value as { id?: unknown }).id === "number",
      )
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.e2ePassthrough.customValue" /* i18n: custom の値 */,
        ),
      }),
    symbolValue: z.symbol().register(zf.common.registry, {
      label: msgKey(
        "formDemo.e2ePassthrough.symbolValue" /* i18n: symbol の値 */,
      ),
    }),
    callback: z.function().register(zf.common.registry, {
      label: msgKey(
        "formDemo.e2ePassthrough.callback" /* i18n: function の値 */,
      ),
    }),
    nothing: z
      .never()
      .optional()
      .register(zf.common.registry, {
        label: msgKey("formDemo.e2ePassthrough.nothing" /* i18n: never の値 */),
      }),
    notANumber: z.nan().register(zf.common.registry, {
      label: msgKey("formDemo.e2ePassthrough.notANumber" /* i18n: nan の値 */),
    }),
    // templateLiteral：文字列の欄。形（user-<数>）に合わないとエラー
    userId: z
      .templateLiteral(["user-", z.number()])
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.e2ePassthrough.userId" /* i18n: 利用者 ID（templateLiteral） */,
        ),
      }),
    // nonoptional：optional を打ち消し、必須の欄として描く
    memo: z
      .string()
      .min(1)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2ePassthrough.memo" /* i18n: メモ（nonoptional） */,
        ),
      })
      .optional()
      .nonoptional(),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  title: "Heading",
  anyValue: { a: 1 },
  unknownValue: [1, 2],
  customValue: { id: 7 },
  symbolValue: Symbol.for("e2e"),
  callback: () => 1,
  notANumber: NaN,
  userId: "user-1",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
