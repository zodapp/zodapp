import React from "react";
import z from "zod";
import { Switch, type ZodFormProps } from "@zodapp/zod-form-react/common";

type OptionalSchema = z.ZodOptional<z.ZodTypeAny>;

const OptionalComponent = (props: ZodFormProps<OptionalSchema>) => {
  return (
    <Switch
      {...props}
      schema={props.schema.def.innerType}
      required={false}
      defaultValue={props.defaultValue}
    />
  );
};

export { OptionalComponent as component };
