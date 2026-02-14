/**
 * GenericFilePreview
 * 任意のファイル用のプレビューコンポーネント（フォールバック）
 * ダウンロードリンクを表示する
 */

import { Button, Group, Text } from "@mantine/core";
import { IconDownload, IconFile } from "@tabler/icons-react";
import type { UrlPreviewProps, MediaResolverUrlBased } from "@zodapp/zod-form-react/media";

function GenericFilePreview({ url, mimeType }: UrlPreviewProps) {
  return (
    <Group gap="sm" align="center">
      <IconFile size={32} stroke={1.5} />
      <div>
        <Text size="sm" c="dimmed">
          {mimeType}
        </Text>
        <Button
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          size="xs"
          variant="light"
          leftSection={<IconDownload size={14} />}
        >
          ダウンロード
        </Button>
      </div>
    </Group>
  );
}

/**
 * 任意の MIME type に対するフォールバックの media resolver。
 *
 * URL をダウンロードできるリンクを表示します。
 */
export const genericMediaResolver: MediaResolverUrlBased = {
  mimeType: "*",
  component: GenericFilePreview,
  acceptsUrl: true,
};
