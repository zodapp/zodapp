/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEqualValue } from "../utils/equal";
import React, { useEffect, useMemo } from "react";
import type { ZodForm, ZodFormProps } from "../utils/type";
import {
  getMeta,
  isPreprocessPipe,
  normalizePreprocessValue,
  stripPreprocess,
} from "@zodapp/zod-form";
import { DynamicZodFormDef, useZodFormContext } from "./context";
import { LazyComponentFactory, useLazyFactory } from "./lazyContext";
import { useOptionalFormApi } from "./form";
import { addOuter } from "./outer";

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
 * switch loader が Promise を返す場合は `LazyComponentFactory` で遅延ロードします。
 */
export const Switch: ZodForm = (props: ZodFormProps) => {
  if (isPreprocessPipe(props.schema)) {
    return <PreprocessSwitch {...props} />;
  }
  return <SchemaSwitch {...props} />;
};

/**
 * `z.preprocess` を描画する。
 *
 * preprocess は「型に合わない保存データを中の schema の形にそろえる」変換なので、
 * フォームの値を先にそろえてから（触った扱いにはしない）、preprocess を外した
 * schema で描画する。preprocess に付けた meta は中の schema に移す。
 */
const PreprocessSwitch = (props: ZodFormProps) => {
  const { schema, fieldPath, defaultValue, value } = props;
  // form を使わない部品（reactive・表）では form が無い。そのときは value をそろえるだけにする
  const form = useOptionalFormApi();
  const displaySchema = useMemo(() => stripPreprocess(schema), [schema]);
  const normalizedDefaultValue = useMemo(
    () =>
      defaultValue === undefined
        ? undefined
        : normalizePreprocessValue(schema, defaultValue),
    [schema, defaultValue],
  );
  // form を使わない部品が表示する値も、同じようにそろえる
  const normalizedValue = useMemo(
    () =>
      value === undefined ? undefined : normalizePreprocessValue(schema, value),
    [schema, value],
  );

  useEffect(() => {
    if (!form) return;
    const isRoot = fieldPath === "";
    const read = () =>
      isRoot ? form.state.values : form.getFieldValue(fieldPath);
    // 値の参照が変わったときだけ確かめる（他のフィールドの変更では何もしない）
    let lastSeen: unknown = Symbol("unseen");
    const normalize = () => {
      const current = read();
      if (Object.is(current, lastSeen)) return;
      lastSeen = current;
      const next = normalizePreprocessValue(schema, current);
      if (isEqualValue(current, next)) return;
      if (isRoot) {
        form.baseStore.setState((state: any) => ({ ...state, values: next }));
      } else {
        form.setFieldValue(fieldPath, next as never, {
          dontUpdateMeta: true,
          dontValidate: true,
        });
      }
    };
    normalize();
    // reset などで値が入れ替わったときも、そろえ直す
    const subscription = form.store.subscribe(normalize);
    return () => subscription.unsubscribe();
  }, [form, fieldPath, schema]);

  return (
    <Switch
      {...props}
      schema={displaySchema}
      defaultValue={normalizedDefaultValue}
      value={normalizedValue}
      // preprocess の pipe 自体に付いた検査（.refine() など）を、内の dynamic が包み直せるように渡す
      outer={addOuter(props.outer, schema)}
    />
  );
};

const SchemaSwitch = (props: ZodFormProps) => {
  const lazyFactory = useLazyFactory();

  const { schema } = props;
  const { componentLibrary, notFoundComponent: NotFoundComponent } =
    useZodFormContext();
  const meta = getMeta(schema);
  const { uiType, typeName } = meta ?? {};

  // meta が無いとき（typeName・uiType が undefined）に、"undefined" の名前の部品（z.undefined() の部品）に
  // 当たらないよう、ある名前だけで探す
  const candidates = [
    typeName !== undefined && uiType !== undefined
      ? `${typeName}_${uiType}`
      : undefined,
    uiType !== undefined ? `${schema.type}_${uiType}` : undefined,
    typeName,
    schema.type,
  ];
  const componentDef = candidates
    .map((name) => (name === undefined ? undefined : componentLibrary[name]))
    .find(Boolean);

  if (componentDef) {
    const Component = getLazyComponent(componentDef, lazyFactory);
    // eslint-disable-next-line react-hooks/static-components
    return <Component {...props} />;
  } else {
    // 部品が無い：notFoundComponent（既定は「扱えない」の注記と console.error）を出す
    return <NotFoundComponent {...props} />;
  }
};
