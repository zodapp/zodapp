import { useMemo } from "react";
import type z from "zod";
import { getMeta } from "@zodapp/zod-form";
import type { RegisteredValueActionConfig } from "@zodapp/zod-form/valueAction/types";
import { useZodFormContext, type ValueActionWrapper } from "../common/context";

/**
 * 値ごとの操作（`valueAction`）を、描画を包む関数に変える hook。
 * 値・操作の設定・`valueActionResolver` の3点が揃ったときだけ wrapper を返す。
 */
export const useValueAction = (
  actionConfig: RegisteredValueActionConfig | undefined,
  value: string | null | undefined,
  newTab?: boolean,
): ValueActionWrapper | undefined => {
  const { valueActionResolver, resolverContext } = useZodFormContext();
  return useMemo(() => {
    if (!value || !actionConfig || !valueActionResolver) {
      return undefined;
    }
    return valueActionResolver({
      value,
      actionConfig,
      newTab,
      resolverContext: resolverContext ?? {},
    });
  }, [actionConfig, valueActionResolver, newTab, value, resolverContext]);
};

/**
 * schema の meta の `valueAction`（string / enum）から、描画を包む関数を返す hook。
 */
export const useSchemaValueAction = (
  schema: z.ZodTypeAny,
  value: string | null | undefined,
  newTab?: boolean,
): ValueActionWrapper | undefined => {
  const meta = getMeta(schema) as
    | { valueAction?: RegisteredValueActionConfig }
    | undefined;
  return useValueAction(meta?.valueAction, value, newTab);
};
