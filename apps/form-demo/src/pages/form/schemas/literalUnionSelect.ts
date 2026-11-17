import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "literalUnionSelect";
export const title = "literal の union を選ぶ";
export const description =
  'literal だけの union に uiType: "select"・"badge" を付けると、enum と同じ部品で選べる。数値と文字列を混ぜられ、literal(10) と literal("10") も区別する。配列に uiType: "multipleEnum"・"multipleEnumBadge" を付けると複数選べる';
export const icon = IconListCheck;
export const category = "Basic";

// 数値の 10 と文字の "10" を混ぜた選択肢
const price = () =>
  zf.union([
    zf.literal(10).register(zf.literal.registry, { label: "10（数値）" }),
    zf.literal("10").register(zf.literal.registry, { label: "10（文字）" }),
    zf.literal("free").register(zf.literal.registry, { label: "無料" }),
  ]);

// 色付きの選択肢（バッジで出す）
const size = () =>
  zf.union([
    zf.literal(1).register(zf.literal.registry, { label: "小", color: "teal" }),
    zf.literal(2).register(zf.literal.registry, { label: "中", color: "blue" }),
    zf
      .literal("large")
      .register(zf.literal.registry, { label: "大", color: "grape" }),
  ]);

export const schema = z
  .object({
    // 一つ選ぶ・必須
    price: price().register(zf.union.registry, {
      label: "価格（必須）",
      uiType: "select",
    }),
    // 一つ選ぶ・optional：× で undefined
    optionalPrice: price()
      .register(zf.union.registry, {
        label: "価格（optional）",
        uiType: "select",
      })
      .optional(),
    // 一つ選ぶ・nullable：× で null
    nullablePrice: price()
      .register(zf.union.registry, {
        label: "価格（nullable）",
        uiType: "select",
      })
      .nullable(),
    // 一つ選ぶ・バッジ
    size: size()
      .register(zf.union.registry, {
        label: "サイズ（badge）",
        uiType: "badge",
      })
      .optional(),
    // 複数選ぶ
    prices: zf
      .array(price())
      .register(zf.array.registry, {
        label: "価格（multipleEnum）",
        uiType: "multipleEnum",
      })
      .optional(),
    // 複数選ぶ・バッジ
    sizes: zf
      .array(size())
      .register(zf.array.registry, {
        label: "サイズ（multipleEnumBadge）",
        uiType: "multipleEnumBadge",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

// 価格（必須）は空のまま始める（空で送信すると必須のエラー）
export const defaultValues: Partial<z.input<typeof schema>> = {
  optionalPrice: "10",
  nullablePrice: 10,
  size: "large",
  prices: [10, "free"],
  sizes: [1, "large"],
};

export type SchemaType = z.infer<typeof schema>;
