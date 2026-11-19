import { useResolvedMeta } from "@zodapp/zod-form-react/common";
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
  emptyValueOf,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import type {
  BaseFileConfig,
  FileResolverResult,
} from "@zodapp/zod-form/file/types";
import { parseMimeTypeFromUrl } from "@zodapp/zod-form/file";
import { findMediaResolver } from "@zodapp/zod-form-react/media";
import { DataBasedPreview } from "@zodapp/zod-form-mantine-lite";
import type z from "zod";
import { useMsg } from "../messages/useMsg";

type FileSchema = z.ZodString;

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

const ExternalFileComponent = wrapComponent(
  function ExternalFileComponentImplement({
    schema,
    label: labelFromParent,
    outer,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<FileSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const meta = useResolvedMeta(schema, "externalFile");
    const msg = useMsg();
    const label = labelFromParent ?? meta?.label;

    // config はただのデータ（親や context で変えるときは zf.dynamic で包む）
    const config = meta?.fileConfig as BaseFileConfig | undefined;

    if (!config) {
      throw new Error(
        "fileConfig is not defined in schema. Use zf.externalFile.registry to register the config.",
      );
    }

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

    const emptyValue = emptyValueOf({ optional, nullable });
    const handleDelete = useCallback(async () => {
      if (value && resolverResultRef.current.delete) {
        await resolverResultRef.current.delete(value);
      }
      field.onChange(emptyValue);
    }, [value, field, emptyValue]);

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
              {msg("zodFormMantine.externalFile.remove" /* 削除 */)}
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
                <Text size="lg" inline>
                  {msg(
                    "zodFormMantine.externalFile.dropzone" /* ここにファイルをドラッグ、またはクリックして選択 */,
                  )}
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  {msg(
                    "zodFormMantine.externalFile.maxSize" /* 最大ファイルサイズ: */,
                  )}{" "}
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
  },
);

export { ExternalFileComponent as component };
