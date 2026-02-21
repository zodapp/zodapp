import { Text, TextProps } from "@mantine/core";

type ReadonlyTextProps = {
  children: React.ReactNode;
} & Omit<TextProps, "children">;

const readonlyTextStyle = {
  backgroundColor:
    "var(--zod-form-readonly-background-color, var(--mantine-color-gray-1))",
  color: "var(--mantine-color-gray-7)",
  borderRadius: "var(--mantine-radius-default)",
};

/**
 * 読み取り専用のテキスト表示用コンポーネント
 */
export const ReadonlyText = ({ children, ...props }: ReadonlyTextProps) => {
  return (
    <Text size="sm" p="xs" style={readonlyTextStyle} {...props}>
      {children}
    </Text>
  );
};
