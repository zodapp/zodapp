import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconUpload } from "@tabler/icons-react";

export const formId = "file";
export const title = "zf.externalFile";
export const description = msgKey(
  "formDemo.page.file.description" /* i18n: ファイルを添付してプレビューする。保存先は差し替えられる */,
);
export const icon = IconUpload;
export const category = "Basic";

export const schema = z
  .object({
    profileImage: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey(
          "formDemo.file.profileImage" /* i18n: プロフィール画像 */,
        ),
        fileConfig: {
          type: "mock",
          mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        },
      })
      .optional(),
    document: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey("formDemo.file.document" /* i18n: ドキュメント */),
        fileConfig: {
          type: "mock",
          mimeTypes: ["application/pdf", "text/plain"],
        },
      })
      .optional(),
    video: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey("formDemo.file.video" /* i18n: 動画ファイル */),
        fileConfig: {
          type: "mock",
          mimeTypes: ["video/mp4", "video/webm"],
        },
      })
      .optional(),
    audio: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey("formDemo.file.audio" /* i18n: 音声ファイル */),
        fileConfig: {
          type: "mock",
          mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg"],
        },
      })
      .optional(),
    anyFile: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey("formDemo.file.anyFile" /* i18n: 任意のファイル */),
        fileConfig: {
          type: "mock",
          // mimeTypesを省略すると全ての種類を許可
        },
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  profileImage: undefined,
  document: undefined,
  video: undefined,
  audio: undefined,
  anyFile: undefined,
};

export type SchemaType = z.infer<typeof schema>;
