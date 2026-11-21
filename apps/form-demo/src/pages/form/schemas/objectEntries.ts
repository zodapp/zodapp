import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconSearch } from "@tabler/icons-react";

export const formId = "objectEntries";
export const title = msgKey(
  "formDemo.page.objectEntries.title" /* i18n: zf.object（項目を足す） */,
);
export const description = msgKey(
  "formDemo.page.objectEntries.description" /* i18n: uiType: entries で、使う項目だけを足していく（検索条件の例）。optional の項目は値にあるときだけ行を出し、⊖ でキーごと消す。必須・nullable の項目は常に出る。足しただけで未入力の行は、値ではキーが undefined で、送信した JSON には入らない */,
);
export const icon = IconSearch;
export const category = "Standard";

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const isEmptyObject = (value: Record<string, unknown>) =>
  Object.values(value).every((item) => item === undefined);

// 以上・以下の範囲。両方空なら、送信の値から項目ごと消す（transform。画面の上では行が残る）
const range = (label: string) =>
  zf
    .object({
      min: zf
        .number()
        .min(0)
        .register(zf.number.registry, {
          label: msgKey("formDemo.objectEntries.range.min" /* i18n: 以上 */),
        })
        .optional(),
      max: zf
        .number()
        .min(0)
        .register(zf.number.registry, {
          label: msgKey("formDemo.objectEntries.range.max" /* i18n: 以下 */),
        })
        .optional(),
    })
    .register(zf.object.registry, { label, uiType: "horizontal" })
    .refine(
      (value) =>
        value.min === undefined ||
        value.max === undefined ||
        value.min <= value.max,
      msgKey(
        "formDemo.objectEntries.range.order" /* i18n: 以上は以下より小さくしてください */,
      ),
    )
    .transform((value) => (isEmptyObject(value) ? undefined : value));

const sortOrder = zf.enum([
  zf.literal("newest").register(zf.literal.registry, {
    label: msgKey("formDemo.objectEntries.sort.newest" /* i18n: 新しい順 */),
  }),
  zf.literal("cheapest").register(zf.literal.registry, {
    label: msgKey("formDemo.objectEntries.sort.cheapest" /* i18n: 安い順 */),
  }),
]);

export const schema = zf
  .object({
    // 検索条件：既定の並び（定義順）
    condition: zf
      .object({
        // 必須の項目は常に出る（⊖ は無い）
        keyword: text(
          msgKey("formDemo.objectEntries.keyword" /* i18n: キーワード */),
        ),
        // optional の項目は、値にあるときだけ行を出す
        title: text(
          msgKey("formDemo.objectEntries.title" /* i18n: タイトル */),
        ).optional(),
        author: text(
          msgKey("formDemo.objectEntries.author" /* i18n: 著者 */),
        ).optional(),
        price: range(
          msgKey("formDemo.objectEntries.price" /* i18n: 価格 */),
        ).optional(),
        sort: sortOrder
          .register(zf.enum.registry, {
            label: msgKey("formDemo.objectEntries.sort" /* i18n: 並べ替え */),
          })
          .optional(),
        // nullable の項目は常に出て、空にすると null（送信した値にも残る）
        publisher: text(
          msgKey("formDemo.objectEntries.publisher" /* i18n: 出版社 */),
        ).nullable(),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.objectEntries.condition" /* i18n: 検索条件（keyOrder: definition） */,
        ),
        uiType: "entries",
      }),
    // 同じ形で keyOrder: "value"：足した順に並ぶ
    conditionByValue: zf
      .object({
        title: text(
          msgKey("formDemo.objectEntries.title" /* i18n: タイトル */),
        ).optional(),
        author: text(
          msgKey("formDemo.objectEntries.author" /* i18n: 著者 */),
        ).optional(),
        price: range(
          msgKey("formDemo.objectEntries.price" /* i18n: 価格 */),
        ).optional(),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.objectEntries.conditionByValue" /* i18n: 検索条件（keyOrder: value） */,
        ),
        uiType: "entries",
        keyOrder: "value",
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  // author は undefined のキー：初めから未入力の行として出す
  condition: { keyword: "zod", author: undefined, publisher: null },
  conditionByValue: { author: "山田" },
};

export type SchemaType = z.infer<typeof schema>;
