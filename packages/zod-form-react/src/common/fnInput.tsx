import React, { createContext, useContext, useMemo } from "react";
import { useStore } from "@tanstack/react-form";
import type { FnInput, FnSourceMeta } from "@zodapp/zod-form";
import { useFormApi } from "./form";
import { useResolverContext } from "./context";
import { getValueAt, parseFieldPath } from "../utils/path";

const assertContext = (meta: FnSourceMeta | undefined, context: unknown) => {
  if (meta?.contextId !== undefined && context === undefined) {
    throw new Error(`resolverContext["${meta.contextId}"] is required`);
  }
};

/**
 * フォームの中で、meta の関数に渡す入力（{@link FnInput}）を組み立てる hook。
 *
 * - `dependsOnValue`（既定 true）なら自分の値を購読する
 * - `dependsOnParent: true` なら親の値を購読する
 * - `contextId` を指定したら resolverContext の該当部分を渡す
 *
 * 返す入力は、購読しているものが変わったときだけ新しくなる。
 */
export const useFnInput = (
  meta: FnSourceMeta | undefined,
  fieldPath: string,
): FnInput => {
  const form = useFormApi();
  const dependsOnValue = meta?.dependsOnValue !== false;
  const dependsOnParent = meta?.dependsOnParent === true;
  const segments = useMemo(() => parseFieldPath(fieldPath), [fieldPath]);
  const value = useStore(form.store, (state: { values: unknown }) =>
    dependsOnValue ? getValueAt(state.values, segments) : undefined,
  );
  const parent = useStore(form.store, (state: { values: unknown }) =>
    dependsOnParent && segments.length > 0
      ? getValueAt(state.values, segments.slice(0, -1))
      : undefined,
  );
  const context = useResolverContext(meta?.contextId);

  return useMemo(() => {
    assertContext(meta, context);
    return {
      // dependsOnValue: false のときは、呼んだ時点の値を渡す（変わっても呼び直さない）
      value: dependsOnValue
        ? value
        : getValueAt(form.state.values, segments),
      parent,
      context,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, dependsOnValue, value, parent, context, segments]);
};

const TableRowContext = createContext<{ row: unknown } | null>(null);

/**
 * 表の行の値を配下の部品に渡す。表用の部品は、ここから `parent` を受け取る。
 */
export const TableRowProvider = ({
  row,
  children,
}: {
  row: unknown;
  children: React.ReactNode;
}) => {
  const value = useMemo(() => ({ row }), [row]);
  return (
    <TableRowContext.Provider value={value}>{children}</TableRowContext.Provider>
  );
};

/** {@link TableRowProvider} が渡す行の値。表の外では undefined */
export function useTableRow(): unknown {
  return useContext(TableRowContext)?.row;
}

/**
 * 表の中で、meta の関数に渡す入力を組み立てる hook。
 * 値はセルに渡された値、親は行の値から取り出す。表は読み取り専用なので購読はしない。
 */
export const useTableFnInput = (
  meta: FnSourceMeta | undefined,
  fieldPath: string,
  value: unknown,
): FnInput => {
  const row = useTableRow();
  const context = useResolverContext(meta?.contextId);
  const dependsOnParent = meta?.dependsOnParent === true;
  return useMemo(() => {
    assertContext(meta, context);
    const segments = parseFieldPath(fieldPath);
    return {
      value,
      parent:
        dependsOnParent && segments.length > 0
          ? getValueAt(row, segments.slice(0, -1))
          : undefined,
      context,
    };
  }, [meta, context, fieldPath, value, row, dependsOnParent]);
};
