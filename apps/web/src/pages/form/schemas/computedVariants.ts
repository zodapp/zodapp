import { z } from "zod";
import { zf, type ComputedValue } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconSparkles } from "@tabler/icons-react";

export const formId = "computedVariants";
export const title = "derived / computed と ComputedValue";
export const description =
  "derived（単一フィールド値の変換）と computed（行全体からの算出）の使い分け、ComputedValue の各表示型（badge / link / icon / title）";
export const icon = IconSparkles;
export const category = "Advanced";

type Status = "active" | "archived" | "draft";

// ステータス → バッジ表示のマップ。
// satisfies を使うと、Status のキー漏れ・ComputedValue に合わない値を
// コンパイル時に検出できる。
const statusBadges = {
  active: { type: "badge", label: "有効", color: "green" },
  archived: { type: "badge", label: "アーカイブ", color: "gray" },
  draft: { type: "badge", label: "下書き", color: "yellow" },
} satisfies Record<Status, Extract<ComputedValue, { type: "badge" }>>;

export const schema = z
  .object({
    heading: zfReact
      .computed()
      .register(zf.computed.registry, {
        compute: () => ({
          type: "title",
          label: "ComputedValue の表示型デモ",
          level: "h3",
        }),
      })
      .optional(),
    // derived: 「そのフィールドの値」だけを受け取って表示を変換する。
    // 値の保存形式（"active" 等）と表示（バッジ）を分離できる。
    // フォームでは表示専用（保存済みの値をテーブルセルや詳細表示で
    // 整形するのが主用途）。
    status: zf
      .enum([
        zf.literal("active").register(zf.literal.registry, { label: "有効" }),
        zf
          .literal("archived")
          .register(zf.literal.registry, { label: "アーカイブ" }),
        zf.literal("draft").register(zf.literal.registry, { label: "下書き" }),
      ])
      .register(zf.enum.registry, { label: "ステータス（編集用）" }),
    statusBadge: zf
      .string()
      .register(zf.derived.registry, {
        label: "ステータス（derivedでバッジ表示）",
        compute: (value: string) =>
          statusBadges[value as Status] ?? { type: "badge", label: value },
      })
      .optional(),
    firstName: zf.string().register(zf.string.registry, { label: "名" }),
    lastName: zf.string().register(zf.string.registry, { label: "姓" }),
    // computed: 「親オブジェクト全体」を受け取って算出する。
    // 複数フィールドを跨いだ計算は computed を使う。
    fullName: zfReact
      .computed()
      .register(zf.computed.registry, {
        label: "氏名（computedで結合）",
        compute: (parent) => `${parent?.lastName ?? ""} ${parent?.firstName ?? ""}`,
      })
      .optional(),
    homepage: zf.string().register(zf.string.registry, { label: "URL" }),
    homepageLink: zf
      .string()
      .register(zf.derived.registry, {
        label: "リンク（type: link）",
        compute: (value: string) =>
          value ? { type: "link", label: value, href: value } : "",
      })
      .optional(),
    // icon は CSS クラス名として描画される（アイコンフォント利用時に有効）
    priority: zfReact
      .computed()
      .register(zf.computed.registry, {
        label: "アイコン（type: icon）",
        compute: () => ({
          type: "icon",
          icon: "ti ti-flag",
          label: "高",
          color: "red",
        }),
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  status: "active",
  statusBadge: "active",
  firstName: "太郎",
  lastName: "山田",
  homepage: "https://example.com",
  homepageLink: "https://example.com",
};

export type SchemaType = z.infer<typeof schema>;
