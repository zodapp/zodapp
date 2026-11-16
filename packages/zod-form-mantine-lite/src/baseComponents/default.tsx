import React from "react";
import z from "zod";
import { Switch, type ZodFormProps } from "@zodapp/zod-form-react/common";

type DefaultSchema = z.ZodDefault<z.ZodTypeAny>;

const DefaultComponent = (props: ZodFormProps<DefaultSchema>) => {
  return (
    <Switch
      {...props}
      schema={props.schema.def.innerType}
      optional={true}
      defaultValue={props.defaultValue ?? null}
    />
  );
};

export { DefaultComponent as component };
