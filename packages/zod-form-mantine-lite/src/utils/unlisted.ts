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

/** 選択肢に無い今の値を、Select に選べない選択肢として足したもの */
export type UnlistedSelectOption = {
  value: string;
  label: string;
  disabled: true;
  color: string;
};

/**
 * Select の選択肢に、選択肢に無い今の値を、選べない選択肢として足す
 * （Select は選択肢に無い値を空欄に見せるので、値が残っていることが分からなくなるため）。
 * label は「（不正な値）」、allowUnlisted の externalKey なら値そのもの。
 * 今の値が無いか、選択肢にあるときは、選択肢をそのまま返す
 */
export const withUnlistedOption = <T extends { value: string }>(
  options: readonly T[],
  value: string | null,
  label: string,
): (T | UnlistedSelectOption)[] =>
  value === null || options.some((option) => option.value === value)
    ? [...options]
    : [...options, { value, label, disabled: true, color: "red" }];
