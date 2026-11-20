import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconWand } from "@tabler/icons-react";

export const formId = "formatterAndSuggestions";
export const title = "zf.string";
export const description = msgKey(
  "formDemo.page.formatterAndSuggestions.description" /* i18n: 入力候補と、readOnly で表示するときの値の整形 */,
);
export const icon = IconWand;
export const category = "Basic";

// suggestions: 入力候補を与えると Autocomplete として描画される。
//   - 文字列の配列、または { label, value } の配列を指定できる
// formatter: readOnly 表示（フォームの読み取り表示・テーブルセル）で
//   値を ComputedValue（文字列/badge等）に整形する。編集時の入力値は変更しない。
export const schema = z
  .object({
    company: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.formatterAndSuggestions.company" /* i18n: 会社名（suggestions: string[]） */,
        ),
        suggestions: ["Acme Corp.", "Globex", "Example Inc."],
      })
      .optional(),
    prefecture: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.formatterAndSuggestions.prefecture" /* i18n: 州（suggestions: {label, value}[]） */,
        ),
        suggestions: [
          { label: "California (CA)", value: "CA" },
          { label: "New York (NY)", value: "NY" },
          { label: "Texas (TX)", value: "TX" },
        ],
      })
      .optional(),
    phone: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.formatterAndSuggestions.phone" /* i18n: 電話番号（formatter, readOnly表示で整形） */,
      ),
      readOnly: true,
      formatter: (value: string) =>
        value.replace(/^(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3"),
    }),
    amount: zf.number().register(zf.number.registry, {
      label: msgKey(
        "formDemo.formatterAndSuggestions.amount" /* i18n: 金額（number formatter, readOnly表示で整形） */,
      ),
      readOnly: true,
      formatter: (value: number) => `$${value.toLocaleString("en-US")}`,
    }),
    status: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.formatterAndSuggestions.status" /* i18n: ステータス（formatterでbadgeを返す） */,
      ),
      readOnly: true,
      formatter: (value: string) => ({
        type: "badge",
        label: value,
        color: value === "Active" ? "green" : "gray",
      }),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  company: "",
  prefecture: "",
  phone: "2125550100",
  amount: 1234567,
  status: "Active",
};

export type SchemaType = z.infer<typeof schema>;
