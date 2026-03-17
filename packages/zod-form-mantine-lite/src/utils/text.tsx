import { Text, TextProps } from "@mantine/core";

type ReadonlyTextProps = {
  children: React.ReactNode;
} & Omit<TextProps, "children">;

const readonlyTextStyle = {
  backgroundColor:
    "var(--zod-form-readonly-background-color, var(--mantine-color-gray-1))",
  color: "var(--zod-form-readonly-color, var(--mantine-color-gray-7))",
  borderRadius:
    "var(--zod-form-readonly-border-radius, var(--mantine-radius-default))",
  padding: "var(--zod-form-readonly-padding, var(--mantine-spacing-xs))",
  minHeight:
    "calc(var(--mantine-font-size-xs) + var(--mantine-spacing-xs) * 2)",
};

/**
 * 読み取り専用のテキスト表示用コンポーネント
 */
export const ReadonlyText = ({ children, ...props }: ReadonlyTextProps) => {
  const { style, ...restProps } = props;

  return (
    <Text size="sm" style={{ ...readonlyTextStyle, ...style }} {...restProps}>
      {children}
    </Text>
  );
};
