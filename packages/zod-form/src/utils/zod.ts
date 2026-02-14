import { $ZodCheck, $ZodCheckDef } from "zod/v4/core";

/**
 * Zod の checks 配列から、指定された kind の check 定義を取り出します。
 *
 * スキーマの制約（min_length 等）に応じた処理をしたい場合に利用します。
 */
export const extractCheck = <Check extends $ZodCheckDef>(
  checks: $ZodCheck[] | undefined,
  kind: Check["check"],
) => {
  return checks?.find((check) => check._zod.def.check === kind)?._zod
    .def as Check;
};
