import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-passthrough";
export const title = "e2e：欄を出さずにそのまま送る型";
export const description =
  "z.any()・z.unknown()・z.custom()・z.symbol()・z.function()・z.never()（optional）・z.nan() は欄を出さず、初期値をそのまま送る。z.templateLiteral() は文字列の欄になり、形に合わないとエラーになる。.nonoptional() は中の欄を描き、空なら送信が止まる";
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    title: zf.string().register(zf.string.registry, { label: "見出し" }),
    anyValue: z.any().register(zf.common.registry, { label: "any の値" }),
    unknownValue: z
      .unknown()
      .register(zf.common.registry, { label: "unknown の値" }),
    customValue: z
      .custom<{
        id: number;
      }>((value) => typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "number")
      .register(zf.common.registry, { label: "custom の値" }),
    symbolValue: z
      .symbol()
      .register(zf.common.registry, { label: "symbol の値" }),
    callback: z
      .function()
      .register(zf.common.registry, { label: "function の値" }),
    nothing: z
      .never()
      .optional()
      .register(zf.common.registry, { label: "never の値" }),
    notANumber: z.nan().register(zf.common.registry, { label: "nan の値" }),
    // templateLiteral：文字列の欄。形（user-<数>）に合わないとエラー
    userId: z
      .templateLiteral(["user-", z.number()])
      .register(zf.common.registry, { label: "利用者 ID（templateLiteral）" }),
    // nonoptional：optional を打ち消し、必須の欄として描く
    memo: z
      .string()
      .min(1)
      .register(zf.string.registry, { label: "メモ（nonoptional）" })
      .optional()
      .nonoptional(),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  title: "見出し",
  anyValue: { a: 1 },
  unknownValue: [1, 2],
  customValue: { id: 7 },
  symbolValue: Symbol.for("e2e"),
  callback: () => 1,
  notANumber: NaN,
  userId: "user-1",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
