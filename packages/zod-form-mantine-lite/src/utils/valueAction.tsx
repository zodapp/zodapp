import React from "react";
import { ActionIcon, Group } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type { ValueActionWrapper } from "@zodapp/zod-form-react/common";

/**
 * 値ごとの操作（valueAction）を開くボタン。wrapper が無ければ何も描画しない。
 */
export const ValueActionIcon = ({
  wrapper,
  label,
}: {
  wrapper: ValueActionWrapper | undefined;
  label: string | undefined;
}) => {
  if (!wrapper) return null;
  return (
    <>
      {wrapper(
        <ActionIcon
          component="span"
          size="md"
          variant="subtle"
          aria-label={`${label ?? "選択済み項目"}を開く`}
          style={
            {
              "--ai-color": "var(--zod-form-external-key-action-color)",
              "--ai-hover": "var(--zod-form-external-key-action-hover-color)",
            } as React.CSSProperties
          }
        >
          <IconExternalLink size={16} />
        </ActionIcon>,
      )}
    </>
  );
};

/**
 * 入力欄の右に値ごとの操作のボタンを並べる。wrapper が無ければ入力欄だけを返す。
 */
export const WithValueAction = ({
  wrapper,
  label,
  align = "flex-end",
  children,
}: {
  wrapper: ValueActionWrapper | undefined;
  label: string | undefined;
  align?: "flex-end" | "center";
  children: React.ReactNode;
}) => {
  if (!wrapper) return <>{children}</>;
  return (
    <Group gap="0" wrap="nowrap" align={align}>
      <div style={{ flex: 1 }}>{children}</div>
      <ValueActionIcon wrapper={wrapper} label={label} />
    </Group>
  );
};
