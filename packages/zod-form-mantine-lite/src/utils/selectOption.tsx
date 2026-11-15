import React from "react";
import { Badge, type BadgeProps, type SelectProps } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export type OptionDataType = {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
};

/**
 * 選択肢をバッジで描く。uiType が badge の enum の、選択肢・選択済みの値・読み取り専用表示で共通に使う
 */
export const renderBadge = (
  option: { label: string; color?: string },
  props?: Omit<BadgeProps, "color" | "children">,
) => (
  <Badge color={option.color ?? "gray"} variant="light" size="md" {...props}>
    {option.label}
  </Badge>
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
