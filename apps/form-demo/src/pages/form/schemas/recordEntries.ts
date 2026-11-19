import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconListDetails } from "@tabler/icons-react";

export const formId = "recordEntries";
export const title = "zf.record";
export const description =
  "キーと値の組を、追加・削除・編集する。キーが enum・literal で決まっている record はキーごとの固定の欄、partialRecord と Map は組を足して編集する欄になる";
export const icon = IconListDetails;
export const category = "Standard";

// キーに使える文字を制限（record_entries はキー入力のバリデーションも通す）
const envKeySchema = zf
  .string()
  .min(1, "キーを入力してください")
  .regex(/^[A-Z][A-Z0-9_]*$/, "大文字英数字とアンダースコアのみ使用できます");

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
    // partialRecord：キーは enum でも固定の欄にならず、組を足して編集する
    nicknames: z
      .partialRecord(
        z.enum(["alice", "bob", "carol"]),
        zf.string().register(zf.string.registry, {}),
      )
      .register(zf.record.registry, {
        label: "あだ名（キーが enum の partialRecord）",
        uiType: "entries",
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
  quota: new Map([
    ["daily", 10],
    ["monthly", 100],
  ]),
};

export type SchemaType = z.infer<typeof schema>;
