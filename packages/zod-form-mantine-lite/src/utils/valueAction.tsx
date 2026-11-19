import React from "react";
import { ActionIcon, Group } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type { ValueActionWrapper } from "@zodapp/zod-form-react/common";
import { useMsg } from "../messages/useMsg";

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
  const msg = useMsg();
  if (!wrapper) return null;
  return (
    <>
      {wrapper(
        <ActionIcon
          component="span"
          size="md"
          variant="subtle"
          aria-label={msg(
            "zodFormMantineLite.open" /* i18n: ${label}を開く */,
            {
              label:
                label ||
                msg("zodFormMantineLite.selectedItem" /* i18n: 選択済み項目 */),
            },
          )}
          style={
            {
              "--ai-color":
                "var(--zod-form-external-key-action-color, var(--mantine-color-anchor))",
              "--ai-hover":
                "var(--zod-form-external-key-action-hover-color, var(--mantine-color-default-hover))",
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
