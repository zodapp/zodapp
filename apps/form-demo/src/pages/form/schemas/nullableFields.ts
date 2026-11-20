import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconCircleDashed } from "@tabler/icons-react";

export const formId = "nullableFields";
export const title = "nullable・optional";
export const description = msgKey(
  "formDemo.page.nullableFields.description" /* i18n: 空にしたときに書く値：nullable だけの欄は null（必須のエラーにならず、空のまま送信できる）、optional の欄（optional と nullable の両方を含む）は undefined。nullable の object は null で始まり、＋で開いて、削除で null に戻る */,
);
export const icon = IconCircleDashed;
export const category = "Basic";

const colorField = () =>
  zf.enum([
    zf.literal("red").register(zf.literal.registry, {
      label: msgKey("formDemo.nullableFields.colorField.red" /* i18n: 赤 */),
    }),
    zf.literal("blue").register(zf.literal.registry, {
      label: msgKey("formDemo.nullableFields.colorField.blue" /* i18n: 青 */),
    }),
  ]);

export const schema = z
  .object({
    // nullable だけ：空にすると null
    nullableText: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.nullableFields.nullableText" /* i18n: 文字（nullable） */,
        ),
      })
      .nullable(),
    nullableNumber: zf
      .number()
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.nullableFields.nullableNumber" /* i18n: 数値（nullable） */,
        ),
      })
      .nullable(),
    nullableColor: colorField()
      .register(zf.enum.registry, {
        label: msgKey(
          "formDemo.nullableFields.nullableColor" /* i18n: 色（nullable） */,
        ),
      })
      .nullable(),
    nullableDate: z.iso
      .date()
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.nullableFields.nullableDate" /* i18n: 日付（nullable） */,
        ),
      })
      .nullable(),
    // optional と nullable の両方：空にすると undefined
    optionalNullableText: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.nullableFields.optionalNullableText" /* i18n: 文字（optional・nullable） */,
        ),
      })
      .optional()
      .nullable(),
    // optional だけ：空にすると undefined
    optionalText: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.nullableFields.optionalText" /* i18n: 文字（optional） */,
        ),
      })
      .optional(),
    // nullable の object：初期値は null（＋の行）。＋で開き、削除で null に戻る
    nullableDetail: z
      .object({
        note: zf.string().register(zf.string.registry, {
          label: msgKey(
            "formDemo.nullableFields.nullableDetail.note" /* i18n: 備考 */,
          ),
        }),
        count: zf
          .number()
          .register(zf.number.registry, {
            label: msgKey(
              "formDemo.nullableFields.nullableDetail.count" /* i18n: 件数 */,
            ),
          })
          .default(1),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.nullableFields.nullableDetail" /* i18n: 詳細（nullable） */,
        ),
        uiType: "box",
      })
      .nullable(),
    // optional の object：削除で undefined に戻る
    optionalDetail: z
      .object({
        memo: zf.string().register(zf.string.registry, {
          label: msgKey(
            "formDemo.nullableFields.optionalDetail.memo" /* i18n: メモ */,
          ),
        }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.nullableFields.optionalDetail" /* i18n: 補足（optional） */,
        ),
        uiType: "box",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  nullableText: "入力済み",
  nullableNumber: 3,
  nullableColor: "red",
  nullableDate: "2026-11-17",
  optionalNullableText: "入力済み",
  optionalText: "入力済み",
  nullableDetail: null,
  optionalDetail: { memo: "メモ" },
};

export type SchemaType = z.infer<typeof schema>;
