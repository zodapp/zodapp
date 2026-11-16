import React from "react";
import z from "zod";
import {
  SamePathProvider,
  Switch,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";

type DefaultSchema = z.ZodDefault<z.ZodTypeAny>;

const DefaultComponent = (props: ZodFormProps<DefaultSchema>) => {
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

export { DefaultComponent as component };
