import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconListDetails } from "@tabler/icons-react";

export const formId = "recordEntries";
export const title = "Record（キー/値エディタ）";
export const description =
  "uiType: entries による Record のキー/値ペアの追加・削除・編集UI";
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
};

export type SchemaType = z.infer<typeof schema>;
