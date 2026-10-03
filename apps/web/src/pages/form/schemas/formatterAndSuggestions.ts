import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconWand } from "@tabler/icons-react";

export const formId = "formatterAndSuggestions";
export const title = "入力補助（suggestions / formatter）";
export const description =
  "文字列の入力候補（Autocomplete）と、readOnly表示時のformatterによる整形";
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
        label: "会社名（suggestions: string[]）",
        suggestions: ["株式会社サンプル", "サンプル工業", "Example Inc."],
      })
      .optional(),
    prefecture: zf
      .string()
      .register(zf.string.registry, {
        label: "都道府県（suggestions: {label, value}[]）",
        suggestions: [
          { label: "東京都 (13)", value: "13" },
          { label: "大阪府 (27)", value: "27" },
          { label: "北海道 (01)", value: "01" },
        ],
      })
      .optional(),
    phone: zf.string().register(zf.string.registry, {
      label: "電話番号（formatter, readOnly表示で整形）",
      readOnly: true,
      formatter: (value: string) =>
        value.replace(/^(\d{2,3})(\d{4})(\d{4})$/, "$1-$2-$3"),
    }),
    amount: zf.number().register(zf.number.registry, {
      label: "金額（number formatter, readOnly表示で整形）",
      readOnly: true,
      formatter: (value: number) => `¥${value.toLocaleString("ja-JP")}`,
    }),
    status: zf.string().register(zf.string.registry, {
      label: "ステータス（formatterでbadgeを返す）",
      readOnly: true,
      formatter: (value: string) => ({
        type: "badge",
        label: value,
        color: value === "有効" ? "green" : "gray",
      }),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  company: "",
  prefecture: "",
  phone: "0312345678",
  amount: 1234567,
  status: "有効",
};

export type SchemaType = z.infer<typeof schema>;
