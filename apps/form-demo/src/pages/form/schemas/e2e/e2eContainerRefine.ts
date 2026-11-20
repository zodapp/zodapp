import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-container-refine";
export const title = msgKey(
  "formDemo.page.e2eContainerRefine.title" /* i18n: e2e：入れ物の refine */,
);
export const description = msgKey(
  "formDemo.page.e2eContainerRefine.description" /* i18n: object・array・record・union に、path を指定しない .refine() を付けた。入れ物の最後の欄を離すとエラーが出て、直すと消え、送信できる。期間は終了を開始より後に、メンバーは重複なしに、配分は合計 100 以下に、連絡先のメールは @example.com に */,
);
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    period: z
      .object({
        start: zf.number().register(zf.number.registry, { label: "開始" }),
        end: zf.number().register(zf.number.registry, { label: "終了" }),
      })
      .refine((value) => value.end > value.start, {
        message: "終了は開始より後にしてください",
      })
      .register(zf.object.registry, { label: "期間（object）" }),
    members: z
      .array(zf.string().register(zf.string.registry, { label: "メンバー" }))
      .refine((value) => new Set(value).size === value.length, {
        message: "メンバーが重複しています",
      })
      .register(zf.array.registry, { label: "メンバー（array）" }),
    shares: z
      .record(
        zf.enum([
          zf.literal("a").register(zf.literal.registry, { label: "A 社" }),
          zf.literal("b").register(zf.literal.registry, { label: "B 社" }),
        ]),
        zf.number().register(zf.number.registry, {}),
      )
      .refine(
        (value) => Object.values(value).reduce((sum, n) => sum + n, 0) <= 100,
        { message: "配分の合計は 100 以下にしてください" },
      )
      .register(zf.record.registry, { label: "配分（record）" }),
    contact: z
      .discriminatedUnion("type", [
        z
          .object({
            type: z.literal("email"),
            email: zf
              .string()
              .register(zf.string.registry, { label: "メール" }),
          })
          .register(zf.object.registry, { label: "メール" }),
        z
          .object({
            type: z.literal("phone"),
            phone: zf
              .string()
              .register(zf.string.registry, { label: "電話番号" }),
          })
          .register(zf.object.registry, { label: "電話" }),
      ])
      .refine(
        (value) =>
          value.type !== "email" || value.email.endsWith("@example.com"),
        { message: "メールは @example.com にしてください" },
      )
      .register(zf.union.registry, {
        label: "連絡先（union）",
        selectorLabel: "連絡先の種類",
      }),
    memo: zf
      .string()
      .register(zf.string.registry, { label: "メモ" })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  period: { start: 1, end: 5 },
  members: ["山田", "佐藤"],
  shares: { a: 40, b: 40 },
  contact: { type: "email", email: "info@example.com" },
  memo: "",
};

export type SchemaType = z.infer<typeof schema>;
