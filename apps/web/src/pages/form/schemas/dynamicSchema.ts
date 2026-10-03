import { z } from "zod";
import { zf, asRegistrySchemaResolver } from "@zodapp/zod-form";
import { IconBolt } from "@tabler/icons-react";

export const formId = "dynamicSchema";
export const title = "動的スキーマ（zf.dynamic）";
export const description =
  "フィールドの現在値からスキーマを実行時に解決する。通知方法の選択に応じて設定項目が切り替わる";
export const icon = IconBolt;
export const category = "Advanced";

type NotificationType = "email" | "slack" | "webhook";

const typeField = zf
  .enum([
    zf.literal("email").register(zf.literal.registry, { label: "メール" }),
    zf.literal("slack").register(zf.literal.registry, { label: "Slack" }),
    zf.literal("webhook").register(zf.literal.registry, { label: "Webhook" }),
  ])
  .register(zf.enum.registry, { label: "通知方法" });

// 通知方法ごとの設定スキーマ。type フィールド自身も含めることで、
// フォーム内で type を変更 → dynamic の値が変わる → resolve が再実行 →
// スキーマが切り替わる、というループが成立する。
const notificationSchemas = {
  email: z
    .object({
      type: typeField,
      to: zf
        .string()
        .register(zf.string.registry, { label: "宛先", uiType: "email" }),
      subject: zf.string().register(zf.string.registry, { label: "件名" }),
    })
    .register(zf.object.registry, { uiType: "box" }),
  slack: z
    .object({
      type: typeField,
      channel: zf
        .string()
        .register(zf.string.registry, { label: "チャンネル（#general など）" }),
      mention: zf
        .boolean()
        .register(zf.boolean.registry, { label: "@channel メンション" })
        .optional(),
    })
    .register(zf.object.registry, { uiType: "box" }),
  webhook: z
    .object({
      type: typeField,
      url: zf.string().register(zf.string.registry, { label: "URL" }),
      secret: zf
        .string()
        .register(zf.string.registry, {
          label: "署名シークレット",
          uiType: "password",
        })
        .optional(),
    })
    .register(zf.object.registry, { uiType: "box" }),
} satisfies Record<NotificationType, z.ZodTypeAny>;

const fallbackSchema = z
  .object({ type: typeField })
  .register(zf.object.registry, { uiType: "box" });

export const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "ルール名" }),
    // zf.dynamic: resolve(value, context) が返したスキーマで描画される。
    // resolve は Promise を返してもよい（外部からのスキーマ取得などの
    // 遅延解決にも対応）。
    notification: zf
      .dynamic()
      .register(zf.dynamic.registry, {
        label: "通知設定",
        resolve: asRegistrySchemaResolver((value) => {
          const type = (value as { type?: NotificationType } | undefined)
            ?.type;
          return type ? notificationSchemas[type] : fallbackSchema;
        }),
      })
      .optional(),
  })
  .register(zf.object.registry, {});

// dynamic フィールドは静的には値型を持たない（実際の型は resolve が返す
// スキーマで決まる）ため、初期値は unknown 経由でキャストする
export const defaultValues = {
  name: "障害通知",
  notification: {
    type: "email",
    to: "alert@example.com",
    subject: "[ALERT] 障害が発生しました",
  },
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
