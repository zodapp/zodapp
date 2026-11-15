import { useState, useEffect, useMemo, useRef } from "react";
import z from "zod";
import {
  getMeta,
  getResolverContextSlice,
  zf,
  type DynamicMetaDef,
  type ExternalKeyMetaDef,
  type DeliveredSchema,
} from "@zodapp/zod-form";
import { stableStringify } from "@zodapp/caching-utilities";
import {
  useExternalKeyResolver,
  useZodFormContext,
  type ValueActionWrapper,
} from "../common/context";
import type {
  BaseExternalKeyConfig,
  ExternalKeyResolverResult,
  ExternalKeyResolvers,
} from "@zodapp/zod-form/externalKey/types";
import type { RegisteredResolverContext } from "@zodapp/zod-form/resolverContext/types";
import type { RegisteredValueActionConfig } from "@zodapp/zod-form/valueAction/types";
import { useValueAction } from "./valueAction";

type ExternalKeySchema = z.ZodString;

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

  const config = externalKeyConfig as BaseExternalKeyConfig;

  // resolverを取得（毎レンダリングで新しいオブジェクトが返される）
  const resolverResult = useExternalKeyResolver(config);

  // resolverResultをrefに保存して、useEffectの依存配列を安定させる
  const resolverResultRef = useRef<ExternalKeyResolverResult>(resolverResult);
  // eslint-disable-next-line react-hooks/refs
  resolverResultRef.current = resolverResult;

  const configType = config.type;
  const contextId =
    "contextId" in config
      ? (config as unknown as { contextId: string }).contextId
      : undefined;
  const { resolverContext } = useZodFormContext();

  // subscribeしてoptionsを取得
  useEffect(() => {
    setOptions(null);
    const unsubscribe = resolverResultRef.current.subscribe((newOptions) => {
      // valueの重複を排除
      const normalizedOptions = Object.values(
        Object.fromEntries(newOptions.map((option) => [option.value, option])),
      );
      setOptions(normalizedOptions);
    });

    return unsubscribe;
  }, [configType, contextId, resolverContext, config]);

  if (options === null) {
    return { options: null, isLoading: true };
  }

  return { options, isLoading: false };
};

/**
 * ExternalKey の現在値に対する action wrapper を取得する hook。
 * 値・schema meta・runtime resolver の3点が揃ったときだけ wrapper を返す。
 *
 * 解決順: field explicit > collectionReferenceActionMap > none
 */
export const useExternalKeyAction = (
  schema: ExternalKeySchema,
  value: string | null | undefined,
  newTab?: boolean,
): ValueActionWrapper | undefined => {
  const meta = getMeta(schema, "externalKey");
  const { collectionReferenceActionMap } = useZodFormContext();

  const explicitActionConfig = meta?.valueAction as
    | RegisteredValueActionConfig
    | undefined;

  const externalKeyConfig = meta?.externalKeyConfig;
  const resolvedConfig = externalKeyConfig as BaseExternalKeyConfig | undefined;

  const referenceActionConfig = useMemo(() => {
    if (
      explicitActionConfig ||
      !collectionReferenceActionMap ||
      !resolvedConfig
    ) {
      return undefined;
    }
    if ("reference" in resolvedConfig) {
      const ref = (resolvedConfig as unknown as { reference: object })
        .reference;
      return collectionReferenceActionMap.get(ref);
    }
    return undefined;
  }, [explicitActionConfig, collectionReferenceActionMap, resolvedConfig]);

  return useValueAction(
    explicitActionConfig ?? referenceActionConfig,
    value,
    newTab,
  );
};

const dedupeOptions = (options: ExternalKeyOption[]): ExternalKeyOption[] =>
  Object.values(
    Object.fromEntries(options.map((option) => [option.value, option])),
  );

// externalKey の meta のうち、選択肢の schema に引き継ぐ表示用の指定
const pickDisplayMeta = (meta: ExternalKeyMetaDef) => {
  const {
    externalKeyConfig: _config,
    valueAction: _valueAction,
    allowUnlisted: _allowUnlisted,
    typeName: _typeName,
    ...rest
  } = meta as ExternalKeyMetaDef & { typeName?: string };
  return rest;
};

/**
 * 選択肢から schema を作る。既定は enum（選択肢に無い値は誤り）、
 * allowUnlisted なら string + 選択式（選択肢に無い値も通す）。
 */
const buildOptionsSchema = (
  meta: ExternalKeyMetaDef,
  options: ExternalKeyOption[],
  valueAction: RegisteredValueActionConfig | undefined,
): z.ZodTypeAny => {
  const display = pickDisplayMeta(meta);
  if (meta.allowUnlisted) {
    return zf.string().register(zf.string.registry, {
      ...display,
      uiType: "select",
      suggestions: options,
      valueAction,
    });
  }
  const literals = options.map((option) =>
    zf.literal(option.value).register(zf.literal.registry, {
      label: option.label,
    }),
  );
  return zf
    .enum(literals as unknown as [z.ZodLiteral<string>])
    .register(zf.enum.registry, {
      ...display,
      valueAction,
      unlisted: meta.unlisted,
      emptyMessage: meta.emptyMessage,
    });
};

/**
 * collectionReferenceActions から、config の reference に対応する既定の操作を引く
 */
const findReferenceAction = (
  config: BaseExternalKeyConfig,
  referenceActionMap: ReadonlyMap<object, RegisteredValueActionConfig> | undefined,
): RegisteredValueActionConfig | undefined => {
  if (!referenceActionMap || !("reference" in config)) return undefined;
  return referenceActionMap.get(
    (config as unknown as { reference: object }).reference,
  );
};

/**
 * externalKey の meta から、dynamic の meta を作る。
 *
 * resolve は config から resolver を引き、選択肢を購読して schema を届ける。
 * key は config（関数を除く）と、config が使う resolverContext から作るので、
 * 同じ key のあいだは購読を張り直さず、選択肢の更新は描画だけを変える。
 */
export const createExternalKeyDynamicMeta = ({
  meta,
  resolvers,
  resolverContext,
  referenceActionMap,
}: {
  meta: ExternalKeyMetaDef;
  resolvers: ExternalKeyResolvers | undefined;
  resolverContext: RegisteredResolverContext | undefined;
  referenceActionMap?: ReadonlyMap<object, RegisteredValueActionConfig>;
}): DynamicMetaDef => {
  const config = meta.externalKeyConfig as BaseExternalKeyConfig;
  const valueAction =
    (meta.valueAction as RegisteredValueActionConfig | undefined) ??
    findReferenceAction(config, referenceActionMap);
  const contextId =
    "contextId" in config
      ? (config as unknown as { contextId?: string }).contextId
      : undefined;
  // config に key があればそれを config の同一性とし、なければ config を文字列にして使う
  const key = stableStringify({
    config: config.key !== undefined ? { key: config.key } : { config },
    context: getResolverContextSlice(resolverContext, contextId),
    allowUnlisted: meta.allowUnlisted === true,
  });

  return {
    dependsOnValue: false, // 選んだ値では resolve し直さない
    resolve: () => {
      const entry = resolvers?.find((candidate) => candidate.type === config.type);
      if (!resolvers) {
        throw new Error(
          "externalKeyResolvers is not configured in ZodFormContextProvider",
        );
      }
      if (!entry) {
        throw new Error(
          `ExternalKeyResolver for type "${config.type}" not found in externalKeyResolvers`,
        );
      }
      return {
        key,
        subscribe: (emit: (delivered: DeliveredSchema) => void) =>
          entry
            .resolver(config, resolverContext ?? {})
            .subscribe((options) =>
              emit({
                schema: buildOptionsSchema(
                  meta,
                  dedupeOptions(options),
                  valueAction,
                ),
              }),
            ),
      };
    },
  } as DynamicMetaDef;
};

/**
 * externalKey の schema から、dynamic の meta を作る hook。
 * resolver の一覧はライブラリの context（externalKeyResolvers）から取る。
 */
export const useExternalKeyDynamicMeta = (
  schema: ExternalKeySchema,
): DynamicMetaDef => {
  const meta = getMeta(schema, "externalKey") as ExternalKeyMetaDef | undefined;
  if (!meta?.externalKeyConfig) {
    throw new Error(
      "externalKeyConfig is not defined in schema. Use zf.externalKey.registry to register the config.",
    );
  }
  const { externalKeyResolvers, resolverContext, collectionReferenceActionMap } =
    useZodFormContext();
  return useMemo(
    () =>
      createExternalKeyDynamicMeta({
        meta,
        resolvers: externalKeyResolvers,
        resolverContext,
        referenceActionMap: collectionReferenceActionMap,
      }),
    [meta, externalKeyResolvers, resolverContext, collectionReferenceActionMap],
  );
};
