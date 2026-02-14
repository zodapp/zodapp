import { useState, useEffect, useMemo, useRef } from "react";
import { getMeta } from "@zodapp/zod-form";
import { useExternalKeyResolver } from "../common/context";
import type {
  ExternalKeyConfig,
  BaseExternalKeyConfig,
  ExternalKeyResolverResult,
} from "@zodapp/zod-form/externalKey/types";
import type z from "zod";

type ExternalKeySchema = z.ZodString;

/**
 * ExternalKeyConfigからconfigを解決する
 * 関数形式の場合はrender時に実行
 */
const resolveConfig = <TConfig extends BaseExternalKeyConfig>(
  config: ExternalKeyConfig<TConfig>,
): TConfig => {
  if (typeof config === "function") {
    return config();
  }
  return config as TConfig;
};

/**
 * 外部キー候補（選択肢）の1件。
 *
 * `label` は表示用、`value` は保存/参照用の値を表します。
 */
export type ExternalKeyOption = {
  label: string;
  value: string;
};

/**
 * `useExternalKeyOptions()` の戻り値。
 *
 * options は購読（subscribe）結果が揃うまで `null` となります。
 */
export type UseExternalKeyOptionsResult =
  | { options: null; isLoading: true }
  | { options: ExternalKeyOption[]; isLoading: false };

/**
 * ExternalKey用のオプションを取得するhook
 * schemaからexternalKeyConfigを取得し、resolverを通じてoptionsをsubscribeする
 */
export const useExternalKeyOptions = (
  schema: ExternalKeySchema,
): UseExternalKeyOptionsResult => {
  const meta = getMeta(schema, "externalKey");

  const [options, setOptions] = useState<ExternalKeyOption[] | null>(null);

  // ExternalKeyConfigからconfigを解決
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const externalKeyConfig = meta?.externalKeyConfig;

  if (!externalKeyConfig) {
    throw new Error(
      "externalKeyConfig is not defined in schema. Use zf.externalKey.registry to register the config.",
    );
  }

  const config = useMemo(
    () => resolveConfig(externalKeyConfig),
    [externalKeyConfig],
  );

  // resolverを取得（毎レンダリングで新しいオブジェクトが返される）
  const resolverResult = useExternalKeyResolver(config);

  // resolverResultをrefに保存して、useEffectの依存配列を安定させる
  const resolverResultRef = useRef<ExternalKeyResolverResult>(resolverResult);
  // eslint-disable-next-line react-hooks/refs
  resolverResultRef.current = resolverResult;

  // config.typeとconfig.conditionIdを安定した依存として使用
  const configType = config.type;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditionId = (config as any).conditionId as string | undefined;

  // subscribeしてoptionsを取得
  useEffect(() => {
    const unsubscribe = resolverResultRef.current.subscribe((newOptions) => {
      setOptions(newOptions);
    });

    return unsubscribe;
  }, [configType, conditionId]);

  if (options === null) {
    return { options: null, isLoading: true };
  }

  return { options, isLoading: false };
};
