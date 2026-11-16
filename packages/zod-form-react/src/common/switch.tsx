/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { useFormApi } from "./form";
import { SamePathProvider, useEmptiness } from "./samePath";

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
  // 同じ path の内側の部品に、自分の schema（外側の包み）を伝える
  return (
    <SamePathProvider path={props.fieldPath} schema={props.schema}>
      {isPreprocessPipe(props.schema) ? (
        <PreprocessSwitch {...props} />
      ) : (
        <SchemaSwitch {...props} />
      )}
    </SamePathProvider>
  );
};

const isEqualValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    isEqualValue(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
};

/**
 * `z.preprocess` を描画する。
 *
 * preprocess は「型に合わない保存データを中の schema の形にそろえる」変換なので、
 * フォームの値を先にそろえてから（触った扱いにはしない）、preprocess を外した
 * schema で描画する。preprocess に付けた meta は中の schema に移す。
 */
const PreprocessSwitch = (props: ZodFormProps) => {
  const { schema, fieldPath, defaultValue } = props;
  const form = useFormApi();
  const displaySchema = useMemo(() => stripPreprocess(schema), [schema]);
  const normalizedDefaultValue = useMemo(
    () =>
      defaultValue === undefined
        ? undefined
        : normalizePreprocessValue(schema, defaultValue),
    [schema, defaultValue],
  );

  useEffect(() => {
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
    />
  );
};

const SchemaSwitch = (rawProps: ZodFormProps) => {
  const lazyFactory = useLazyFactory();

  const { schema } = rawProps;
  // optional・nullable は props で受け渡さず、同じ path の連なりから求める
  const emptiness = useEmptiness(rawProps.fieldPath);
  const props: ZodFormProps = {
    ...rawProps,
    optional: emptiness.optional ? true : undefined,
    nullable: emptiness.nullable ? true : undefined,
  };
  const { componentLibrary, notFoundComponent: NotFoundComponent } =
    useZodFormContext();
  const meta = getMeta(schema);
  const { uiType, typeName } = meta ?? {};

  const componentDef =
    componentLibrary[`${typeName}_${uiType}`] ||
    componentLibrary[`${schema.type}_${uiType}`] ||
    componentLibrary[`${typeName}`] ||
    componentLibrary[`${schema.type}`];

  if (componentDef) {
    const Component = getLazyComponent(componentDef, lazyFactory);
    // eslint-disable-next-line react-hooks/static-components
    return <Component {...props} />;
  } else {
    console.log(
      "componentDef not found",
      schema,
      `${typeName ?? schema.type}_${uiType}`,
      `${typeName ?? schema.type}`,
    );
    return (
      <div>
        <NotFoundComponent {...props} />
      </div>
    );
  }
};
