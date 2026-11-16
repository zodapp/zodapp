import React from "react";
import z from "zod";
import {
  SamePathProvider,
  Switch,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";

type OptionalSchema = z.ZodOptional<z.ZodTypeAny>;

const OptionalComponent = (props: ZodFormProps<OptionalSchema>) => {
  return (
    <SamePathProvider path={props.fieldPath} schema={props.schema}>
      <Switch
        {...props}
        schema={props.schema.def.innerType}
        defaultValue={props.defaultValue}
      />
    </SamePathProvider>
  );
};

export { OptionalComponent as component };
