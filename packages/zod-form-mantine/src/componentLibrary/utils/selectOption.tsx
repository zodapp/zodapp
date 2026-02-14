import React from "react";
import { Badge, SelectProps } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export type OptionDataType = {
  value: string;
  label: string;
  color?: string;
};

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
      <Badge color={color} variant="light" size="md">
        {label}
      </Badge>
    </>
  );
};

