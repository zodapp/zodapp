/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { ZodForm, ZodFormProps } from "../utils/type";
import { getMeta } from "@zodapp/zod-form";
import { DynamicZodFormDef, useZodFormContext } from "./context";
import { LazyComponentFactory, useLazyFactory } from "./lazyContext";

const memoizeGetLazyComponentMap = new WeakMap<
  DynamicZodFormDef,
  React.ComponentType<any>
>();

const getLazyComponent = (
  componentDef: DynamicZodFormDef,
  lazyFactory: LazyComponentFactory,
) => {
  const cached = memoizeGetLazyComponentMap.get(componentDef);
  if (cached) return cached;

  const result = componentDef();

  let Component: React.ComponentType<any>;
  if (result instanceof Promise) {
    // Promiseの場合のみlazyFactoryでlazy化
    Component = lazyFactory(() => result);
  } else {
    // Promiseでない場合はそのまま返す
    Component = result.component;
  }

  memoizeGetLazyComponentMap.set(componentDef, Component);
  return Component;
};

/**
 * スキーマ meta（`getMeta`）から UI コンポーネントを動的に選択して描画します。
 *
 * `componentLibrary` から `typeName_uiType`（なければ `typeName`）で検索し、
 * Dynamic loader が Promise を返す場合は `LazyComponentFactory` で遅延ロードします。
 */
export const Dynamic: ZodForm = (props: ZodFormProps) => {
  const lazyFactory = useLazyFactory();

  const { schema } = props;
  const { componentLibrary, notFoundComponent: NotFoundComponent } =
    useZodFormContext();
  const meta = getMeta(schema);
  const { uiType, typeName } = meta ?? {};

  const componentDef =
    componentLibrary[`${typeName ?? schema.type}_${uiType}`] ||
    componentLibrary[`${typeName ?? schema.type}`];

  if (componentDef) {
    const Component = getLazyComponent(componentDef, lazyFactory);
    // eslint-disable-next-line react-hooks/static-components
    return <Component {...props} />;
  } else {
    return (
      <div>
        <NotFoundComponent {...props} />
      </div>
    );
  }
};
