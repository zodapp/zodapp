import { msgKey } from "@zodapp/i18n-messages";
import { useMemo } from "react";
import { z } from "zod";
import { zf, createMockFileResolver } from "@zodapp/zod-form";
import type {
  DataPreviewProps,
  MediaResolvers,
} from "@zodapp/zod-form-react/media";
import { defaultMediaResolvers } from "@zodapp/zod-form-mantine";
import { Code, ScrollArea } from "@mantine/core";
import { IconPhotoVideo } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import { createE2eHarness } from "../../../components/E2eHarness";

export const formId = "mediaPreview";
export const title = msgKey(
  "formDemo.page.mediaPreview.title" /* i18n: zf.externalFile（プレビューの種類） */,
);
export const description = msgKey(
  "formDemo.page.mediaPreview.description" /* i18n: アップロードしたファイルの mimeType に応じたプレビューの仕組み。標準の image / video / audio resolver、フォールバックの genericMediaResolver、自作の data ベース resolver（テキスト内容表示） */,
);
export const icon = IconPhotoVideo;
export const category = "Standard";

export const schema = z
  .object({
    image: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey(
          "formDemo.mediaPreview.image" /* i18n: 画像（imageMediaResolver → <img> プレビュー） */,
        ),
        fileConfig: {
          type: "mock",
          mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        },
      })
      .optional(),
    audio: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey(
          "formDemo.mediaPreview.audio" /* i18n: 音声（audioMediaResolver → <audio> プレビュー） */,
        ),
        fileConfig: {
          type: "mock",
          mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg"],
        },
      })
      .optional(),
    textFile: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey(
          "formDemo.mediaPreview.textFile" /* i18n: テキスト（自作の data ベース resolver で内容を表示） */,
        ),
        fileConfig: {
          type: "mock",
          mimeTypes: ["text/plain", "text/csv", "text/markdown"],
        },
      })
      .optional(),
    anyFile: zf
      .string()
      .register(zf.externalFile.registry, {
        label: msgKey(
          "formDemo.mediaPreview.anyFile" /* i18n: その他（genericMediaResolver → ダウンロードリンク） */,
        ),
        fileConfig: {
          type: "mock",
        },
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {};

// data ベースの resolver（acceptsUrl: false）:
// URL ではなく取得済みの ArrayBuffer を受け取る。
// テキストや CSV のように「内容を描画したい」ファイルに使う。
const TextPreview = ({ data }: DataPreviewProps) => {
  const text = useMemo(() => {
    try {
      return new TextDecoder("utf-8").decode(data).slice(0, 2000);
    } catch {
      return "(decode error)";
    }
  }, [data]);
  return (
    <ScrollArea.Autosize mah={200}>
      <Code block>{text}</Code>
    </ScrollArea.Autosize>
  );
};

// resolver は配列順に mimeType パターンでマッチする（先勝ち）。
// 自作 resolver を defaultMediaResolvers（image/video/audio + generic
// フォールバック）の前に置くことで text/* だけ差し替える。
const mediaResolvers: MediaResolvers = [
  { mimeType: "text/*", acceptsUrl: false, component: TextPreview },
  ...defaultMediaResolvers,
];

// 見るための部品（値・エラー・送信・ログ）
const harness = [createE2eHarness({ formId })];

export const Component = () => {
  const fileResolvers = useMemo(() => [createMockFileResolver()], []);
  return (
    <AutoForm
      schema={schema}
      defaultValues={defaultValues}
      fileResolvers={fileResolvers}
      mediaResolvers={mediaResolvers}
      actionComponents={harness}
    />
  );
};

export type SchemaType = z.infer<typeof schema>;
