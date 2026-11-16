import React from "react";
import z from "zod";

/**
 * ZodForm コンポーネントが受け取る共通 props。
 *
 * - `fieldPath`: TanStack React Form 等のフィールドパス
 * - `schema`: 対象フィールドの Zod スキーマ
 * - `defaultValue`: 初期値（任意）
 *
 * 欄が空を受け付けるか（外側の optional・nullable）は props では渡さない。
 * 同じ path の schema の連なりから `useEmptiness(fieldPath)` で求める。
 * - `readOnly`: UI 制御のヒント（任意）
 * - `label`: 表示ラベル（任意。通常は schema meta から取得する想定）
 */
export type ZodFormProps<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  fieldPath: string;
  schema: TSchema;
  defaultValue?: z.infer<TSchema>;
  readOnly?: boolean;
  /**
   * Label to display above the input.
   *
   * - `false`: hide label (parent component renders the label)
   * - `string`: explicit label override（通常は schema meta（getMeta）から取得する想定のため、基本的に渡さない）
   */
  label?: string | false;
};

/**
 * `ZodFormProps` を受け取るフィールド UI コンポーネント型。
 */
export type ZodForm<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = React.FC<
  ZodFormProps<TSchema>
>;

/**
 * 遅延ロード等で「コンポーネント定義」を扱うためのラッパー型。
 *
 * `component` に実体の `ZodForm` を格納します。
 */
export type ZodFormDef<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  component: ZodForm<TSchema>;
};
