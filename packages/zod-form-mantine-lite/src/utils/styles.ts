import type { CSSProperties } from "react";

/**
 * InputWrapper 共通のスタイル。
 * --zod-form-input-wrapper-margin-top を設定すると margin-top を上書きできる。
 */
export const inputWrapperStyle: CSSProperties = {
  marginTop:
    "var(--zod-form-input-wrapper-margin-top, calc(0.3125rem * var(--mantine-scale)))",
};

/**
 * 複数行の文字列入力（Textarea）の Mantine の styles。
 * --zod-form-string-multiline-max-height を設定すると、高さの上限を決められる（既定は上限なし）。
 * 上限を超えた分は Textarea の中でスクロールする。
 */
export const stringMultilineStyles: { input: CSSProperties } = {
  input: {
    maxHeight: "var(--zod-form-string-multiline-max-height, none)",
    overflowY: "auto",
  },
};
