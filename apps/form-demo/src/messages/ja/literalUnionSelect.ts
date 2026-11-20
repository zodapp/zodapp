import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/literalUnionSelect";

/** form-demo の日本語の辞書（literalUnionSelect） */
export const ja = {
  "formDemo.page.literalUnionSelect.description":
    'literal だけの union に uiType: "select"・"badge" を付けると、enum と同じ部品で選べる。literal に入る値（文字列・数値・bigint・boolean・null・undefined）をすべて選べ、literal(10) と literal("10") も区別する。z.null()・z.undefined() の腕も選べ、optional・nullable と併用すると腕を優先する。配列に uiType: "multipleEnum"・"multipleEnumBadge" を付けると複数選べる',
} satisfies MessagesOf<typeof en>;
