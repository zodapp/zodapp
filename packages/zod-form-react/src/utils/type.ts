import React from "react";
import type { Outer } from "../common/outer";
import z from "zod";

/**
 * ZodForm コンポーネントが受け取る共通 props。
 *
 * - `fieldPath`: TanStack React Form 等のフィールドパス
 * - `schema`: 対象フィールドの Zod スキーマ
 * - `value`: form を使わない部品（reactive・表）が表示する値（任意）。form を使わない部品にだけ渡される。
 *   form の中では渡さず（いつも undefined）、form を使う部品は値を `useField` で store から読む。
 *   同じ path に描く包みは `{...props}` でそのまま子へ渡し、手を付けない
 * - `defaultValue`: 新しく値を作るときの初期値（任意。union の腕を選んだときなど）。form を使う部品が使う
 * - `outer`: 同じ path の外側の包みの情報（任意）。包みの部品が自分の分を足して渡す。
 *   path が変わるところでは消して渡す。部品は `emptinessOf(outer)` で optional・nullable・空の値を求める
 * - `readOnly`: UI 制御のヒント（任意）
 * - `label`: 表示ラベル（任意。通常は schema meta から取得する想定）
 * - `hideError`: この部品の path のエラーを出さない（任意）。同じ path の祖先（intersection）が代わりに出す。
 *   同じ path に描く包みは `{...props}` で子へ渡し、path が変わるところでは渡さない
 * - `errorToken`: 同じ path で、すぐ外側の union の writer（任意）。union が腕に渡す。
 *   入れ子の union が、外側の union が自分あてに書いた invalid_union を読み分けるのと、
 *   union の腕に unrecognized_keys を出させない（union が読む）のに使う。
 *   同じ path に描く包みは `{...props}` で子へ渡し、path が変わるところでは渡さない
 */
export type ZodFormProps<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  fieldPath: string;
  schema: TSchema;
  /** form を使わない部品が表示する値。form の中では渡されない */
  value?: unknown;
  /** 新しく値を作るときの初期値（form を使う部品が使う） */
  defaultValue?: z.infer<TSchema>;
  outer?: Outer;
  readOnly?: boolean;
  /**
   * Label to display above the input.
   *
   * - `false`: hide label (parent component renders the label)
   * - `string`: explicit label override（通常は schema meta（getMeta）から取得する想定のため、基本的に渡さない）
   */
  label?: string | false;
  /** この部品の path のエラーを出さない（同じ path の祖先が出す） */
  hideError?: boolean;
  /** 同じ path で、すぐ外側の union の writer */
  errorToken?: object;
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
