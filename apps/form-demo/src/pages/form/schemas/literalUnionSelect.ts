import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "literalUnionSelect";
export const title = "zf.union（literal）";
export const description = msgKey(
  "formDemo.page.literalUnionSelect.description" /* i18n: literal だけの union に uiType: "select"・"badge" を付けると、enum と同じ部品で選べる。literal に入る値（文字列・数値・bigint・boolean・null・undefined）をすべて選べ、literal(10) と literal("10") も区別する。z.null()・z.undefined() の腕も選べ、optional・nullable と併用すると腕を優先する。配列に uiType: "multipleEnum"・"multipleEnumBadge" を付けると複数選べる */,
);
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

// boolean・bigint・値を複数持つ literal と、null・undefined の腕（ラベルは zf.common.registry で付ける）
const answer = () =>
  zf.union([
    zf.literal(true).register(zf.literal.registry, { label: "はい" }),
    zf.literal(false).register(zf.literal.registry, { label: "いいえ" }),
    zf.literal(10n),
    zf.literal(["a", "b"]),
    z.undefined().register(zf.common.registry, { label: "未回答" }),
    z.null().register(zf.common.registry, { label: "該当なし" }),
  ]);

// 空の値の腕を 1 つだけ持つ選択肢（optional・nullable との併用を試す）
const answerWith = (empty: "undefined" | "null") =>
  zf.union([
    zf.literal(true).register(zf.literal.registry, { label: "はい" }),
    zf.literal(false).register(zf.literal.registry, { label: "いいえ" }),
    empty === "undefined"
      ? z.undefined().register(zf.common.registry, { label: "未回答" })
      : z.null().register(zf.common.registry, { label: "該当なし" }),
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
    // literal に入るすべての値と、null・undefined の腕。値が無いときは「未回答」の腕に見える
    answer: answer().register(zf.union.registry, {
      label: "回答（すべての値）",
      uiType: "select",
    }),
    // undefined の腕があるので optional は無いものとし、× を出さない
    answerOptional: answerWith("undefined")
      .register(zf.union.registry, {
        label: "回答（optional・undefined の腕）",
        uiType: "select",
      })
      .optional(),
    // null の腕があるので nullable は無いものとし、× を出さない
    answerNullable: answerWith("null")
      .register(zf.union.registry, {
        label: "回答（nullable・null の腕）",
        uiType: "select",
      })
      .nullable(),
    // null の腕（該当なし）があるので nullable は無いものとし、× で undefined（未回答）を書く
    answerBoth: answerWith("null")
      .register(zf.union.registry, {
        label: "回答（optional・nullable・null の腕）",
        uiType: "select",
      })
      .optional()
      .nullable(),
  })
  .register(zf.object.registry, {});

// 価格（必須）は空のまま始める（空で送信すると必須のエラー）
export const defaultValues: Partial<z.input<typeof schema>> = {
  optionalPrice: "10",
  nullablePrice: 10,
  size: "large",
  prices: [10, "free"],
  sizes: [1, "large"],
  answerNullable: true,
  answerBoth: true,
};

export type SchemaType = z.infer<typeof schema>;
