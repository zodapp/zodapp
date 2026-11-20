import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconBraces } from "@tabler/icons-react";

export const formId = "reactiveRecord";
export const title = "zf.record (Reactive)";
export const description = msgKey(
  "formDemo.page.reactiveRecord.description" /* i18n: z.record(z.string(), ...) によるキー・バリュー形式のフォーム。キー名がラベルになります。 */,
);
export const icon = IconBraces;
export const category = "Reactive";
export const reactive = true;

const settingValueSchema = zf
  .string()
  .register(zf.string.registry, { uiType: "text" });

export const schema = z
  .object({
    projectName: zf
      .string()
      .min(1)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveRecord.projectName" /* i18n: プロジェクト名 */,
        ),
        uiType: "text",
      }),

    settings: z
      .record(z.string(), settingValueSchema)
      .register(zf.record.registry, {
        label: msgKey("formDemo.reactiveRecord.settings" /* i18n: 設定値 */),
        uiType: "box",
      }),
  })
  .register(zf.object.registry, {
    uiType: "box",
    label: msgKey("formDemo.reactiveRecord.root" /* i18n: Record サンプル */),
  });

export const defaultValues: z.input<typeof schema> = {
  projectName: "Sample project",
  settings: {
    apiEndpoint: "https://api.example.com",
    timeout: "30",
    maxRetries: "3",
    logLevel: "info",
  },
};

export type SchemaType = z.infer<typeof schema>;
