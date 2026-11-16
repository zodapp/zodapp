import React from "react";
import {
  Badge,
  parseThemeColor,
  useMantineTheme,
  type BadgeProps,
  type SelectProps,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { computeBadgeColors } from "./badgeColor";

export type OptionDataType = {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
};

type ColorBadgeProps = Omit<BadgeProps, "color" | "variant" | "vars"> & {
  color?: string;
};

/**
 * 色付きのバッジ（未指定は primaryColor）。
 *
 * - 濃さなしのテーマ色（`"blue"` など）は Mantine の `light` のまま
 * - 濃さ付きのテーマ色（`"blue.6"`）・RGB（`#3b82f6`・`rgb()`・`hsl()`）は、背景をその色そのものにし、
 *   文字色を背景から決める（badgeColor.ts）
 * - 透明度のある色・`var()`・名前の CSS 色は計算できないので `light` のまま
 */
export const ColorBadge = ({ color: colorProp, ...props }: ColorBadgeProps) => {
  const theme = useMantineTheme();
  // 未指定は Mantine の Badge と同じく primaryColor
  const color = colorProp ?? theme.primaryColor;
  const parsed = parseThemeColor({ color, theme });
  const computed =
    parsed.isThemeColor && parsed.shade === undefined
      ? null
      : computeBadgeColors(parsed.value);
  return (
    <Badge
      color={color}
      variant="light"
      vars={
        computed
          ? () => ({
              root: {
                "--badge-bg": computed.background,
                "--badge-color": computed.color,
                "--badge-bd": "1px solid transparent",
              },
            })
          : undefined
      }
      {...props}
    />
  );
};

/**
 * 選択肢をバッジで描く。uiType が badge の enum の、選択肢・選択済みの値・読み取り専用表示で共通に使う
 */
export const renderBadge = (
  option: { label: string; color?: string },
  props?: Omit<ColorBadgeProps, "color" | "children">,
) => (
  <ColorBadge color={option.color ?? "gray"} size="md" {...props}>
    {option.label}
  </ColorBadge>
);

export const renderSelectOption: SelectProps["renderOption"] = ({
  option,
  checked,
}) => {
  const { label } = option;
  const color = (option as unknown as OptionDataType).color ?? "gray";

  return (
    <>
      {checked && (
        <IconCheck
          style={{
            opacity: 0.4,
            width: "1em",
            minWidth: "1em",
            height: "1em",
            display: "block",
            marginRight: "-0.2em",
          }}
          stroke={2}
        />
      )}
      {renderBadge({ label, color })}
    </>
  );
};
