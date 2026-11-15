import type { z } from "zod";

/** 値が選択肢に無いときに、ID などの生の値の代わりに出す文言（フォームの欄と同じ） */
export const UNLISTED_LABEL = "（不正な値）";

/** enum の値が選択肢にあるか（数値の選択肢も文字列にして比べる） */
export const isEnumValueListed = (
  enumSchema: z.ZodEnum<z.core.util.EnumLike>,
  value: string | number,
): boolean =>
  (enumSchema.options as readonly (string | number)[]).some(
    (option) => String(option) === String(value),
  );

/**
 * externalKey の値の表示名。選択肢にあればそのラベル。
 * 選択肢に無ければ、allowUnlisted なら値そのもの（正しい値なので）、そうでなければ「（不正な値）」
 */
export const externalKeyDisplayLabel = (
  options: readonly { label: string; value: string }[],
  value: string,
  allowUnlisted: boolean,
): string => {
  const option = options.find((candidate) => candidate.value === value);
  if (option) return option.label;
  return allowUnlisted ? value : UNLISTED_LABEL;
};
