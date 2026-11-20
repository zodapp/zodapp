import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf, type ComputedValue } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconSparkles } from "@tabler/icons-react";

export const formId = "computedVariants";
export const title = msgKey(
  "formDemo.page.computedVariants.title" /* i18n: zf.computed（表示の形） */,
);
export const description = msgKey(
  "formDemo.page.computedVariants.description" /* i18n: 計算結果を、バッジ・リンク・アイコン・見出しとして表示する */,
);
export const icon = IconSparkles;
export const category = "Advanced";

type Status = "active" | "archived" | "draft";

// ステータス → バッジ表示のマップ。
// satisfies を使うと、Status のキー漏れ・ComputedValue に合わない値を
// コンパイル時に検出できる。
const statusBadges = {
  active: {
    type: "badge",
    label: msgKey(
      "formDemo.computedVariants.statusBadge.active" /* i18n: 有効 */,
    ),
    color: "green",
  },
  archived: {
    type: "badge",
    label: msgKey(
      "formDemo.computedVariants.statusBadge.archived" /* i18n: アーカイブ */,
    ),
    color: "gray",
  },
  draft: {
    type: "badge",
    label: msgKey(
      "formDemo.computedVariants.statusBadge.draft" /* i18n: 下書き */,
    ),
    color: "yellow",
  },
} satisfies Record<Status, Extract<ComputedValue, { type: "badge" }>>;

export const schema = z
  .object({
    heading: zfReact.computed().register(zf.computed.registry, {
      compute: () => ({
        type: "title",
        label: msgKey(
          "formDemo.computedVariants.heading.compute" /* i18n: ComputedValue の表示型デモ */,
        ),
        level: "h3",
      }),
    }),
    // 値を持つ欄の computed: 「そのフィールドの値」を受け取って表示を変換する。
    // 値の保存形式（"active" 等）と表示（バッジ）を分離できる。
    // フォームでは表示専用（保存済みの値をテーブルセルや詳細表示で
    // 整形するのが主用途）。
    status: zf
      .enum([
        zf.literal("active").register(zf.literal.registry, {
          label: msgKey(
            "formDemo.computedVariants.status.active" /* i18n: 有効 */,
          ),
        }),
        zf.literal("archived").register(zf.literal.registry, {
          label: msgKey(
            "formDemo.computedVariants.status.archived" /* i18n: アーカイブ */,
          ),
        }),
        zf.literal("draft").register(zf.literal.registry, {
          label: msgKey(
            "formDemo.computedVariants.status.draft" /* i18n: 下書き */,
          ),
        }),
      ])
      .register(zf.enum.registry, {
        label: msgKey(
          "formDemo.computedVariants.status" /* i18n: ステータス（編集用） */,
        ),
      }),
    statusBadge: zf
      .string()
      .register(zf.computed.registry, {
        label: msgKey(
          "formDemo.computedVariants.statusBadge" /* i18n: ステータス（computedでバッジ表示） */,
        ),
        compute: ({ value }: { value: string }) =>
          statusBadges[value as Status] ?? { type: "badge", label: value },
      })
      .optional(),
    firstName: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.computedVariants.firstName" /* i18n: 名 */),
    }),
    lastName: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.computedVariants.lastName" /* i18n: 姓 */),
    }),
    // dependsOnParent: true の computed: 「親オブジェクト全体」を受け取って算出する。
    // 複数フィールドを跨いだ計算はこちらを使う。
    fullName: zfReact.computed().register(zf.computed.registry, {
      label: msgKey(
        "formDemo.computedVariants.fullName" /* i18n: 氏名（computedで結合） */,
      ),
      dependsOnParent: true,
      compute: ({ parent }) =>
        `${parent?.lastName ?? ""} ${parent?.firstName ?? ""}`,
    }),
    homepage: zf.string().register(zf.string.registry, { label: "URL" }),
    homepageLink: zf
      .string()
      .register(zf.computed.registry, {
        label: msgKey(
          "formDemo.computedVariants.homepageLink" /* i18n: リンク（type: link） */,
        ),
        compute: ({ value }: { value: string }) =>
          value ? { type: "link", label: value, href: value } : "",
      })
      .optional(),
    // icon は CSS クラス名として描画される（アイコンフォント利用時に有効）
    priority: zfReact.computed().register(zf.computed.registry, {
      label: msgKey(
        "formDemo.computedVariants.priority" /* i18n: アイコン（type: icon） */,
      ),
      compute: () => ({
        type: "icon",
        icon: "ti ti-flag",
        label: msgKey(
          "formDemo.computedVariants.priority.compute" /* i18n: 高 */,
        ),
        color: "red",
      }),
    }),
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
