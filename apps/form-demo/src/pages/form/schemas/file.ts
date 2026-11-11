import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconUpload } from "@tabler/icons-react";

export const formId = "file";
export const title = "ファイル";
export const description =
  "ファイルアップロード・プレビュー機能のサンプル。fileResolverを切り替えることで、複数のクラウドストレージに対応できる。このサンプルではmockFileResolverを利用してdataURLとして保存。";
export const icon = IconUpload;
export const category = "Basic";

export const schema = z
  .object({
    profileImage: zf
      .string()
      .register(zf.file.registry, {
        label: "プロフィール画像",
        fileConfig: () => ({
          type: "mock",
          mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        }),
      })
      .optional(),
    document: zf
      .string()
      .register(zf.file.registry, {
        label: "ドキュメント",
        fileConfig: () => ({
          type: "mock",
          mimeTypes: ["application/pdf", "text/plain"],
        }),
      })
      .optional(),
    video: zf
      .string()
      .register(zf.file.registry, {
        label: "動画ファイル",
        fileConfig: () => ({
          type: "mock",
          mimeTypes: ["video/mp4", "video/webm"],
        }),
      })
      .optional(),
    audio: zf
      .string()
      .register(zf.file.registry, {
        label: "音声ファイル",
        fileConfig: () => ({
          type: "mock",
          mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg"],
        }),
      })
      .optional(),
    anyFile: zf
      .string()
      .register(zf.file.registry, {
        label: "任意のファイル",
        fileConfig: () => ({
          type: "mock",
          // mimeTypesを省略すると全ての種類を許可
        }),
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
