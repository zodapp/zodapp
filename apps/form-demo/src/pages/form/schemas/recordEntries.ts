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
  .min(1, "キーを入力してください")
  .regex(/^[A-Z][A-Z0-9_]*$/, "大文字英数字とアンダースコアのみ使用できます");

// 都道府県（キーの多い enum の例）
const prefecture = z.enum([
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
]);

export const schema = z
  .object({
    // 既定の record UI はキーをラベルとした固定フィールド表示
    // uiType: "entries" でキー自体を追加・削除・リネームできるエディタになる
    envVars: z
      .record(envKeySchema, zf.string().register(zf.string.registry, {}))
      .register(zf.record.registry, {
        label: "環境変数（uiType: entries）",
        uiType: "entries",
      }),
    labels: z
      .record(
        zf.string().min(1),
        zf.number().min(0).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: "数値の Record（値の型も任意のスキーマにできる）",
        uiType: "entries",
      }),
    // キーが enum：列挙したキーを、選択肢の label を名前にした固定の欄として並べる
    greeting: z
      .record(
        zf.enum([
          zf.literal("ja").register(zf.literal.registry, { label: "日本語" }),
          zf.literal("en").register(zf.literal.registry, { label: "英語" }),
          zf.literal("zh").register(zf.literal.registry, { label: "中国語" }),
        ]),
        zf.string().min(1).register(zf.string.registry, {}),
      )
      .register(zf.record.registry, { label: "挨拶（キーが enum）" }),
    // キーが値を複数持つ literal：同じく固定の欄（名前はキーの値）
    stock: z
      .record(
        z.literal(["small", "medium", "large"]),
        zf.number().min(0).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: "サイズ別の在庫（キーが複数の値の literal）",
      }),
    // キーが enum の partialRecord（既定）：候補のキーを全部並べ、各欄は optional。空にするとキーごと消す
    nicknames: z
      .partialRecord(
        zf.enum([
          zf
            .literal("alice")
            .register(zf.literal.registry, { label: "アリス" }),
          zf.literal("bob").register(zf.literal.registry, { label: "ボブ" }),
          zf.literal("carol").register(zf.literal.registry, {
            label: "キャロル",
          }),
        ]),
        zf.string().register(zf.string.registry, {}),
      )
      .register(zf.record.registry, {
        label: "あだ名（キーが enum の partialRecord）",
      }),
    // キーの多い partialRecord（uiType: entries）：値にあるキーだけを並べ、下の選択でキーを足す。並びは定義順
    branches: z
      .partialRecord(
        prefecture,
        zf.number().min(1).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: "支店の数（partialRecord・uiType: entries）",
        uiType: "entries",
      }),
    // 同じ形で keyOrder: "value"：値の object の順（足したキーは末尾）
    branchesByValue: z
      .partialRecord(
        prefecture,
        zf.number().min(1).register(zf.number.registry, {}),
      )
      .register(zf.record.registry, {
        label: "支店の数（keyOrder: value）",
        uiType: "entries",
        keyOrder: "value",
      }),
    // Map：record の entries と同じ見た目で、Map を書く
    quota: z
      .map(z.string().min(1), z.number().min(0))
      .register(zf.common.registry, { label: "上限（Map<string, number>）" }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  envVars: {
    API_URL: "https://api.example.com",
    LOG_LEVEL: "info",
  },
  labels: {
    優先度: 1,
    重要度: 2,
  },
  greeting: { ja: "こんにちは", en: "Hello", zh: "你好" },
  stock: { small: 3, medium: 5, large: 0 },
  nicknames: { alice: "アリー" },
  // 定義順とは違う順で入れておき、keyOrder の違いを見せる
  branches: { 大阪府: 2, 東京都: 5 },
  branchesByValue: { 大阪府: 2, 東京都: 5 },
  quota: new Map([
    ["daily", 10],
    ["monthly", 100],
  ]),
};

export type SchemaType = z.infer<typeof schema>;
