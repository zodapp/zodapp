import type { CSSProperties } from "react";

/**
 * InputWrapper 共通のスタイル。
 * --zod-form-input-wrapper-margin-top を設定すると margin-top を上書きできる。
 */
export const inputWrapperStyle: CSSProperties = {
  marginTop:
    "var(--zod-form-input-wrapper-margin-top, calc(0.3125rem * var(--mantine-scale)))",
};
