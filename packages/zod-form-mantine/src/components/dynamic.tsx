import React, { useEffect, useRef, useState } from "react";
import z from "zod";
import {
  Switch,
  ZodFormInternalProps,
  wrapComponent,
  useFormValues,
  useLazyFactory,
  useZodFormContext,
  type DynamicZodFormDef,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";

type DynamicSchema = z.ZodTypeAny;
type DynamicSchemaResult =
  | DynamicSchema
  | Promise<DynamicSchema | undefined>
  | undefined;

const componentCache = new WeakMap<
  DynamicZodFormDef,
  React.ComponentType<ZodFormInternalProps<DynamicSchema>>
>();

const getLazyComponent = (
  componentDef: DynamicZodFormDef,
  lazyFactory: ReturnType<typeof useLazyFactory>,
) => {
  const cached = componentCache.get(componentDef);
  if (cached) return cached;

  const result = componentDef();
  const Component = (
    result instanceof Promise ? lazyFactory(() => result) : result.component
  ) as React.ComponentType<ZodFormInternalProps<DynamicSchema>>;

  componentCache.set(componentDef, Component);
  return Component;
};

const FallbackSwitch = (props: ZodFormInternalProps<DynamicSchema>) => {
  const lazyFactory = useLazyFactory();
  const { componentLibrary, notFoundComponent: NotFoundComponent } =
    useZodFormContext();
  const meta = getMeta(props.schema);
  const { uiType } = meta ?? {};
  const schemaType = props.schema.type;
  const componentDef =
    componentLibrary[`${schemaType}_${uiType}`] || componentLibrary[schemaType];

  if (!componentDef) {
    return <NotFoundComponent {...props} />;
  }

  const Component = getLazyComponent(componentDef, lazyFactory);
  // eslint-disable-next-line react-hooks/static-components
  return <Component {...props} />;
};

const DynamicRootValueProvider = React.memo(function DynamicRootValueProvider({
  children,
}: {
  children: (value: unknown) => React.ReactNode;
}) {
  const value = useFormValues();
  return <>{children(value)}</>;
});

const DynamicNestedValueProvider = React.memo(
  function DynamicNestedValueProvider({
    fieldPath,
    field,
    children,
  }: {
    fieldPath: string;
    field: ZodFormInternalProps<DynamicSchema>["field"];
    children: (value: unknown) => React.ReactNode;
  }) {
    const value = field.api.form.getFieldValue(fieldPath);
    return <>{children(value)}</>;
  },
);

const DynamicBody = React.memo(function DynamicBody({
  value,
  ...props
}: ZodFormInternalProps<DynamicSchema> & { value: unknown }) {
  const { resolverContext } = useZodFormContext();
  const meta = getMeta(props.schema, "dynamic");
  const requestIdRef = useRef(0);
  const [dynamicSchema, setDynamicSchema] = useState<DynamicSchema>();

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let active = true;

    const applyResult = (schema: DynamicSchema | undefined) => {
      if (!active || requestIdRef.current !== requestId) return;
      setDynamicSchema(schema);
    };
    const scheduleResult = (schema: DynamicSchema | undefined) => {
      void Promise.resolve().then(() => applyResult(schema));
    };

    scheduleResult(undefined);

    try {
      const result = meta?.resolve(
        value,
        resolverContext ?? {},
      ) as DynamicSchemaResult;

      if (result instanceof Promise) {
        result.then(applyResult).catch((error: unknown) => {
          if (!active || requestIdRef.current !== requestId) return;
          console.warn("Failed to resolve zod-form schema", error);
          applyResult(undefined);
        });
        return () => {
          active = false;
        };
      }

      scheduleResult(result);
    } catch (error) {
      console.warn("Failed to resolve zod-form schema", error);
      scheduleResult(undefined);
    }

    return () => {
      active = false;
    };
  }, [meta, resolverContext, value]);

  if (!dynamicSchema || dynamicSchema === props.schema) {
    return <FallbackSwitch {...props} defaultValue={value} />;
  }

  return <Switch {...props} schema={dynamicSchema} defaultValue={value} />;
});

const DynamicComponent = wrapComponent(function DynamicComponentImplement(
  props: ZodFormInternalProps<DynamicSchema>,
) {
  if (props.fieldPath === "") {
    return (
      <DynamicRootValueProvider>
        {(value) => <DynamicBody {...props} value={value} />}
      </DynamicRootValueProvider>
    );
  }

  return (
    <DynamicNestedValueProvider fieldPath={props.fieldPath} field={props.field}>
      {(value) => <DynamicBody {...props} value={value} />}
    </DynamicNestedValueProvider>
  );
});

export { DynamicComponent as component };
