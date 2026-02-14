import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Group, Text, Button } from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { IconUpload, IconFile, IconX } from "@tabler/icons-react";
import {
  ZodFormInternalProps,
  wrapComponent,
  useFileResolver,
  useMediaResolvers,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import type {
  FileConfig,
  BaseFileConfig,
  FileResolverResult,
} from "@zodapp/zod-form/file/types";
import { parseMimeTypeFromUrl } from "@zodapp/zod-form/file";
import { findMediaResolver } from "@zodapp/zod-form-react/media";
import { DataBasedPreview } from "../mediaResolvers/dataBasedPreview";
import type z from "zod";

type FileSchema = z.ZodString;

/**
 * FileConfigからconfigを解決する
 * 関数形式の場合はrender時に実行
 */
const resolveConfig = <TConfig extends BaseFileConfig>(
  config: FileConfig<TConfig>,
): TConfig => {
  if (typeof config === "function") {
    return config();
  }
  return config as TConfig;
};

/** デフォルトの最大ファイルサイズ: 5MB */
const DEFAULT_MAX_SIZE = 5 * 1024 ** 2;

/**
 * ファイルサイズを人間が読みやすい形式にフォーマット
 */
const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
};

const FileComponent = wrapComponent(function FileComponentImplement({
  schema,
  label: labelFromParent,
  required: _required,
  readOnly,
  field,
  error,
}: ZodFormInternalProps<FileSchema>) {
  const meta = getMeta(schema, "file");
  const label = labelFromParent ?? meta?.label;

  // FileConfigからconfigを解決
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileConfig = (meta as any)?.fileConfig as
    | FileConfig<BaseFileConfig>
    | undefined;

  if (!fileConfig) {
    throw new Error(
      "fileConfig is not defined in schema. Use zf.file.registry to register the config.",
    );
  }

  const config = useMemo(() => resolveConfig(fileConfig), [fileConfig]);

  // resolverを取得
  const resolverResult = useFileResolver(config);
  const resolverResultRef = useRef<FileResolverResult>(resolverResult);
  resolverResultRef.current = resolverResult;

  // mediaResolversを取得（Contextから）
  const mediaResolvers = useMediaResolvers();

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const value = field.value ?? null;

  // 既存値がある場合、プレビュー用のURLを取得
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      setMimeType(null);
      return;
    }

    // URLからmimeTypeを抽出
    const extractedMimeType = parseMimeTypeFromUrl(value);
    setMimeType(extractedMimeType ?? null);

    // signedURLを取得
    resolverResultRef.current.getDownloadUrl(value).then(({ url }) => {
      setPreviewUrl(url);

      // mimeTypeがURLになければHEADリクエストで取得
      if (!extractedMimeType) {
        fetch(url, { method: "HEAD" }).then((res) => {
          const contentType = res.headers.get("Content-Type");
          if (contentType) {
            const parsed = contentType.split(";")[0];
            if (parsed) {
              setMimeType(parsed);
            }
          }
        });
      }
    });
  }, [value]);

  const handleDrop = useCallback(
    async (files: FileWithPath[]) => {
      const file = files[0];
      if (!file) return;

      setUploading(true);
      try {
        const { url } = await resolverResultRef.current.upload(file);
        field.onChange(url);
      } finally {
        setUploading(false);
      }
    },
    [field],
  );

  const handleDelete = useCallback(async () => {
    if (value && resolverResultRef.current.delete) {
      await resolverResultRef.current.delete(value);
    }
    field.onChange(undefined);
  }, [value, field]);

  // プレビュー表示
  const renderPreview = () => {
    if (!previewUrl || !mimeType) return null;

    const mediaResolver = findMediaResolver(mediaResolvers, mimeType);
    if (!mediaResolver) return null;

    if (mediaResolver.acceptsUrl) {
      const Component = mediaResolver.component;
      return <Component url={previewUrl} mimeType={mimeType} />;
    } else {
      return (
        <DataBasedPreview
          url={previewUrl}
          mimeType={mimeType}
          component={mediaResolver.component}
        />
      );
    }
  };

  return (
    <div>
      {label && (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      )}
      {value ? (
        <div>
          {renderPreview()}
          <Button
            onClick={handleDelete}
            disabled={readOnly || field.disabled}
            mt="xs"
          >
            削除
          </Button>
        </div>
      ) : (
        <Dropzone
          onDrop={handleDrop}
          onReject={(files) => console.log("rejected files", files)}
          maxSize={config.maxSize ?? DEFAULT_MAX_SIZE}
          accept={config.mimeTypes}
          loading={uploading}
          disabled={readOnly || field.disabled}
        >
          <Group
            justify="center"
            gap="xl"
            mih={220}
            style={{ pointerEvents: "none" }}
          >
            <Dropzone.Accept>
              <IconUpload
                size={52}
                color="var(--mantine-color-blue-6)"
                stroke={1.5}
              />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX
                size={52}
                color="var(--mantine-color-red-6)"
                stroke={1.5}
              />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconFile
                size={52}
                color="var(--mantine-color-dimmed)"
                stroke={1.5}
              />
            </Dropzone.Idle>

            <div>
              <Text size="xl" inline>
                ここにファイルをドラッグ、またはクリックして選択
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                最大ファイルサイズ:{" "}
                {formatFileSize(config.maxSize ?? DEFAULT_MAX_SIZE)}
              </Text>
            </div>
          </Group>
        </Dropzone>
      )}
      {error && (
        <Text size="sm" c="red" mt={4}>
          {error.message}
        </Text>
      )}
    </div>
  );
});

export { FileComponent as component };
