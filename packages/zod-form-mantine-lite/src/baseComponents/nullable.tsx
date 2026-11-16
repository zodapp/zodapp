import React from "react";
import z from "zod";
import {
  SamePathProvider,
  Switch,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";

type NullableSchema = z.ZodNullable<z.ZodTypeAny>;

const NullableComponent = (props: ZodFormProps<NullableSchema>) => {
  return (
    <SamePathProvider path={props.fieldPath} schema={props.schema}>
      <Switch
        {...props}
        schema={props.schema.def.innerType}
        defaultValue={props.defaultValue ?? null}
      />
    </SamePathProvider>
  );
};

export { NullableComponent as component };
