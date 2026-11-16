/**
 * デモページの「動きを試す」の枠。
 * 遅延の分け方・取得を失敗させるスイッチ・選択肢を届け直すボタンなど、
 * フォームの外から動きを起こす操作をここにまとめ、フォームの欄と見分けられるようにする
 */
import type { ReactNode } from "react";
import { Fieldset, Stack, Text } from "@mantine/core";

export const TryBehavior = ({
  description,
  children,
}: {
  /** 何を試せるか（人が読む説明） */
  description?: ReactNode;
  children: ReactNode;
}) => (
  <Fieldset legend="動きを試す" data-testid="try-behavior">
    <Stack gap="sm">
      {description && (
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      )}
      {children}
    </Stack>
  </Fieldset>
);
