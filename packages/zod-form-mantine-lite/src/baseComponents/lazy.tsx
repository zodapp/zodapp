import React, { createContext, useContext, useEffect, useMemo } from "react";
import { InputWrapper, Text } from "@mantine/core";
import z from "zod";
import {
  Switch,
  useResolvedMeta,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { useMsg } from "../messages/useMsg";
import { inputWrapperStyle } from "../utils/styles";

type LazySchema = z.ZodLazy<z.ZodTypeAny>;

/** 再帰の深さの既定の上限（ルートから数えた lazy の入れ子の数） */
export const DEFAULT_LAZY_MAX_DEPTH = 10;

/** 上にある lazy の数と、今の上限 */
const LazyDepthContext = createContext<{ depth: number; maxDepth: number }>({
  depth: 0,
  maxDepth: DEFAULT_LAZY_MAX_DEPTH,
});

/**
 * lazy の数を 0 に戻す（上限は引き継ぐ）。
 *
 * 値が無ければ中を描かない部品（optional・nullable・array・record の entries・Map・union）は、
 * 中をこれで包む。そこから先の描画は値の深さで止まるので、上限で数える必要がない。
 * 上限で数えるのは、値が無くても中を描く所（object・intersection・キーの決まった record など）
 * だけで続いている lazy の連なり（関数で深さを決めた optional なしの再帰など）
 */
export const ResetLazyDepth = ({ children }: { children: React.ReactNode }) => {
  const parent = useContext(LazyDepthContext);
  const value = useMemo(
    () => ({ depth: 0, maxDepth: parent.maxDepth }),
    [parent.maxDepth],
  );
  if (parent.depth === 0) return <>{children}</>;
  return (
    <LazyDepthContext.Provider value={value}>
      {children}
    </LazyDepthContext.Provider>
  );
};

/** 部品を {@link ResetLazyDepth} で包む */
export const withResetLazyDepth = <P extends object>(
  Component: React.ComponentType<P>,
) => {
  const Wrapped = (props: P) => (
    <ResetLazyDepth>
      <Component {...props} />
    </ResetLazyDepth>
  );
  Wrapped.displayName = `WithResetLazyDepth(${Component.displayName ?? Component.name ?? "Component"})`;
  return Wrapped;
};

/** 上限を超えた所に出す注記。値は消さない（描かないだけ） */
const RecursionLimitNotice = ({
  fieldPath,
  label,
  maxDepth,
}: {
  fieldPath: string;
  label: string | false | undefined;
  maxDepth: number;
}) => {
  const msg = useMsg();
  useEffect(() => {
    console.error(
      `[zod-form] Unsupported schema at "${fieldPath}": z.lazy is nested more than ${maxDepth} levels. Set maxDepth in the meta of the z.lazy (zf.common.registry) to raise the limit.`,
    );
  }, [fieldPath, maxDepth]);
  return (
    <InputWrapper
      label={label || undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      <Text c="red" size="sm" data-zod-form-unsupported="">
        {msg(
          "zodFormMantineLite.recursionLimit" /* i18n: これより深い階層は表示できません。schema の meta の maxDepth で上限を変えられます */,
        )}
      </Text>
    </InputWrapper>
  );
};

/**
 * `z.lazy`。中の schema を描く。
 *
 * optional の付かない再帰は、描画が終わらないので、lazy の入れ子の数で止める。
 * 上にある lazy を数え、上限（既定 {@link DEFAULT_LAZY_MAX_DEPTH}）を超えたら、中を描かずに注記を出す。
 * 値が無ければ中を描かない部品（{@link ResetLazyDepth}）を通ったら、数え直す。
 * schema が同じかどうかは見ない。上限は、lazy の meta の `maxDepth`（`zf.common.registry`）で、
 * その lazy から下について変えられる（数はルートから数える）
 */
const LazyComponent = (props: ZodFormProps<LazySchema>) => {
  const parent = useContext(LazyDepthContext);
  const meta = useResolvedMeta(props.schema) as
    | { label?: string; maxDepth?: number }
    | undefined;
  const maxDepth = meta?.maxDepth ?? parent.maxDepth;
  const depth = parent.depth + 1;
  const value = useMemo(() => ({ depth, maxDepth }), [depth, maxDepth]);
  const schema = useMemo(
    () => props.schema.def.getter() as z.ZodTypeAny,
    [props.schema],
  );
  if (depth > maxDepth) {
    return (
      <RecursionLimitNotice
        fieldPath={props.fieldPath}
        label={props.label ?? meta?.label}
        maxDepth={maxDepth}
      />
    );
  }
  return (
    <LazyDepthContext.Provider value={value}>
      <Switch {...props} schema={schema} />
    </LazyDepthContext.Provider>
  );
};

export { LazyComponent as component };
