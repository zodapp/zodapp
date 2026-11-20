import type React from "react";
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
 * 子を並べる入れ物（object・intersection・record）の InputWrapper のスタイル。
 * ラベルがあるときは {@link inputWrapperStyle}。ラベルが無いときは上の余白を付けない。
 *
 * ラベルの無い入れ物の上の余白は、縦並びでは最初の子の上の余白と相殺されて見た目に効かない。
 * 横並び（flex）の中では相殺されず、入れ物と子の余白が 2 回効いて、入れ物の中の欄だけ下がる。
 * そのため、ラベルの無い入れ物は上の余白を 0 にする
 */
export const containerWrapperStyle = (
  label: React.ReactNode | undefined,
): CSSProperties =>
  label ? inputWrapperStyle : { ...inputWrapperStyle, marginTop: 0 };

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
