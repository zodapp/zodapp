import React, { useMemo } from "react";
import z from "zod";
import {
  Dynamic,
  ZodFormInternalProps,
  wrapComponent,
  useFormValues,
  useLazyFactory,
  useZodFormContext,
  type DynamicZodFormDef,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";

type ResolvedSchema = z.ZodTypeAny;

const componentCache = new WeakMap<
  DynamicZodFormDef,
  React.ComponentType<ZodFormInternalProps<ResolvedSchema>>
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
  ) as React.ComponentType<ZodFormInternalProps<ResolvedSchema>>;

  componentCache.set(componentDef, Component);
  return Component;
};

const FallbackDynamic = (props: ZodFormInternalProps<ResolvedSchema>) => {
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

const ResolvedRootValueProvider = React.memo(function ResolvedRootValueProvider({
  children,
}: {
  children: (value: unknown) => React.ReactNode;
}) {
  const value = useFormValues();
  return <>{children(value)}</>;
});

const ResolvedNestedValueProvider = React.memo(
  function ResolvedNestedValueProvider({
    fieldPath,
    field,
    children,
  }: {
    fieldPath: string;
    field: ZodFormInternalProps<ResolvedSchema>["field"];
    children: (value: unknown) => React.ReactNode;
  }) {
    const value = field.api.form.getFieldValue(fieldPath);
    return <>{children(value)}</>;
  },
);

const ResolvedBody = React.memo(function ResolvedBody({
  value,
  ...props
}: ZodFormInternalProps<ResolvedSchema> & { value: unknown }) {
  const { resolverContext } = useZodFormContext();
  const meta = getMeta(props.schema, "resolved");

  const resolvedSchema = useMemo(
    () => meta?.resolve(value, resolverContext ?? {}),
    [meta, resolverContext, value],
  );

  if (!resolvedSchema || resolvedSchema === props.schema) {
    return <FallbackDynamic {...props} defaultValue={value} />;
  }

  return <Dynamic {...props} schema={resolvedSchema} defaultValue={value} />;
});

const ResolvedComponent = wrapComponent(function ResolvedComponentImplement(
  props: ZodFormInternalProps<ResolvedSchema>,
) {
  if (props.fieldPath === "") {
    return (
      <ResolvedRootValueProvider>
        {(value) => <ResolvedBody {...props} value={value} />}
      </ResolvedRootValueProvider>
    );
  }

  return (
    <ResolvedNestedValueProvider fieldPath={props.fieldPath} field={props.field}>
      {(value) => <ResolvedBody {...props} value={value} />}
    </ResolvedNestedValueProvider>
  );
});

export { ResolvedComponent as component };
