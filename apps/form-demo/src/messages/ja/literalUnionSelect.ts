import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/literalUnionSelect";

/** form-demo の日本語の辞書（literalUnionSelect） */
export const ja = {
  "formDemo.page.literalUnionSelect.description":
    'literal だけの union に uiType: "select"・"badge" を付けると、enum と同じ部品で選べる。literal に入る値（文字列・数値・bigint・boolean・null・undefined）をすべて選べ、literal(10) と literal("10") も区別する。z.null()・z.undefined() の腕も選べ、optional・nullable と併用すると腕を優先する。配列に uiType: "multipleEnum"・"multipleEnumBadge" を付けると複数選べる',
  "formDemo.literalUnionSelect.price.10": "10（数値）",
  "formDemo.literalUnionSelect.price.102": "10（文字）",
  "formDemo.literalUnionSelect.price.free": "無料",
  "formDemo.literalUnionSelect.size.1": "小",
  "formDemo.literalUnionSelect.size.2": "中",
  "formDemo.literalUnionSelect.size.large": "大",
  "formDemo.literalUnionSelect.answer.true": "はい",
  "formDemo.literalUnionSelect.answer.false": "いいえ",
  "formDemo.literalUnionSelect.answer.arm4": "未回答",
  "formDemo.literalUnionSelect.answer.arm5": "該当なし",
  "formDemo.literalUnionSelect.answerWith.true": "はい",
  "formDemo.literalUnionSelect.answerWith.false": "いいえ",
  "formDemo.literalUnionSelect.answerWith.arm2": "未回答",
  "formDemo.literalUnionSelect.answerWith.arm22": "該当なし",
  "formDemo.literalUnionSelect.price": "価格（必須）",
  "formDemo.literalUnionSelect.optionalPrice": "価格（optional）",
  "formDemo.literalUnionSelect.nullablePrice": "価格（nullable）",
  "formDemo.literalUnionSelect.size": "サイズ（badge）",
  "formDemo.literalUnionSelect.prices": "価格（multipleEnum）",
  "formDemo.literalUnionSelect.sizes": "サイズ（multipleEnumBadge）",
  "formDemo.literalUnionSelect.answer": "回答（すべての値）",
  "formDemo.literalUnionSelect.answerOptional":
    "回答（optional・undefined の腕）",
  "formDemo.literalUnionSelect.answerNullable": "回答（nullable・null の腕）",
  "formDemo.literalUnionSelect.answerBoth":
    "回答（optional・nullable・null の腕）",
} satisfies MessagesOf<typeof en>;
