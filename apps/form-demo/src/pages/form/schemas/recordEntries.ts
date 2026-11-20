import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconListDetails } from "@tabler/icons-react";

export const formId = "recordEntries";
export const title = "zf.record";
export const description = msgKey(
  "formDemo.page.recordEntries.description" /* i18n: キーと値の組を、追加・削除・編集する。キーが enum・literal で決まっている record はキーごとの固定の欄、Map は組を足して編集する欄になる。キーが enum の partialRecord は、既定では候補のキーを全部並べて各欄を optional にし（空にするとキーごと消す）、uiType: entries では値にあるキーだけを並べて、いちばん下の選択でキーを足す（行は削除だけできる。並びは keyOrder で、definition は定義順、value は値の順） */,
);
export const icon = IconListDetails;
export const category = "Standard";

// キーに使える文字を制限（record_entries はキー入力のバリデーションも通す）
const envKeySchema = zf
  .string()
  .min(
    1,
    msgKey(
      "formDemo.recordEntries.envKeySchema.min" /* i18n: キーを入力してください */,
    ),
  )
  .regex(
    /^[A-Z][A-Z0-9_]*$/,
    msgKey(
      "formDemo.recordEntries.envKeySchema.regex" /* i18n: 大文字英数字とアンダースコアのみ使用できます */,
    ),
  );

// 米国の州（キーの多い enum の例）
const usState = z.enum([
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
]);

export const schema = z
  .object({
    // 既定の record UI はキーをラベルとした固定フィールド表示
    // uiType: "entries" でキー自体を追加・削除・リネームできるエディタになる
    envVars: z
      .record(envKeySchema, zf.string().register(zf.string.registry, {}))
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.envVars" /* i18n: 環境変数（uiType: entries） */,
        ),
        uiType: "entries",
      }),
    labels: z
      .record(
        zf.string().min(1),
        zf.number().min(0).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.labels" /* i18n: 数値の Record（値の型も任意のスキーマにできる） */,
        ),
        uiType: "entries",
      }),
    // キーが enum：列挙したキーを、選択肢の label を名前にした固定の欄として並べる
    greeting: z
      .record(
        zf.enum([
          zf.literal("ja").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.recordEntries.greeting.key.ja" /* i18n: 日本語 */,
            ),
          }),
          zf.literal("en").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.recordEntries.greeting.key.en" /* i18n: 英語 */,
            ),
          }),
          zf.literal("zh").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.recordEntries.greeting.key.zh" /* i18n: 中国語 */,
            ),
          }),
        ]),
        zf.string().min(1).register(zf.string.registry, {}),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.greeting" /* i18n: 挨拶（キーが enum） */,
        ),
      }),
    // キーが値を複数持つ literal：同じく固定の欄（名前はキーの値）
    stock: z
      .record(
        z.literal(["small", "medium", "large"]),
        zf.number().min(0).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.stock" /* i18n: サイズ別の在庫（キーが複数の値の literal） */,
        ),
      }),
    // キーが enum の partialRecord（既定）：候補のキーを全部並べ、各欄は optional。空にするとキーごと消す
    nicknames: z
      .partialRecord(
        zf.enum([
          zf.literal("alice").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.recordEntries.nicknames.key.alice" /* i18n: アリス */,
            ),
          }),
          zf.literal("bob").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.recordEntries.nicknames.key.bob" /* i18n: ボブ */,
            ),
          }),
          zf.literal("carol").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.recordEntries.nicknames.key.carol" /* i18n: キャロル */,
            ),
          }),
        ]),
        zf.string().register(zf.string.registry, {}),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.nicknames" /* i18n: あだ名（キーが enum の partialRecord） */,
        ),
      }),
    // キーの多い partialRecord（uiType: entries）：値にあるキーだけを並べ、下の選択でキーを足す。並びは定義順
    branches: z
      .partialRecord(
        usState,
        zf.number().min(1).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.branches" /* i18n: 支店の数（partialRecord・uiType: entries） */,
        ),
        uiType: "entries",
      }),
    // 同じ形で keyOrder: "value"：値の object の順（足したキーは末尾）
    branchesByValue: z
      .partialRecord(
        usState,
        zf.number().min(1).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.recordEntries.branchesByValue" /* i18n: 支店の数（keyOrder: value） */,
        ),
        uiType: "entries",
        keyOrder: "value",
      }),
    // Map：record の entries と同じ見た目で、Map を書く
    quota: z
      .map(z.string().min(1), z.number().min(0))
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.recordEntries.quota" /* i18n: 上限（Map<string, number>） */,
        ),
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  envVars: {
    API_URL: "https://api.example.com",
    LOG_LEVEL: "info",
  },
  labels: {
    priority: 1,
    severity: 2,
  },
  greeting: { ja: "こんにちは", en: "Hello", zh: "你好" },
  stock: { small: 3, medium: 5, large: 0 },
  nicknames: { alice: "Ally" },
  // 定義順とは違う順で入れておき、keyOrder の違いを見せる
  branches: { Texas: 2, California: 5 },
  branchesByValue: { Texas: 2, California: 5 },
  quota: new Map([
    ["daily", 10],
    ["monthly", 100],
  ]),
};

export type SchemaType = z.infer<typeof schema>;
