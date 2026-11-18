import React from "react";
import z from "zod";
import {
  Switch,
  addOuter,
  innerDefaultValue,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";

type DefaultSchema = z.ZodDefault<z.ZodTypeAny>;

const DefaultComponent = (props: ZodFormProps<DefaultSchema>) => {
  const outer = addOuter(props.outer, props.schema);
  return (
    <Switch
      {...props}
      schema={props.schema.def.innerType}
      outer={outer}
      defaultValue={innerDefaultValue(props.defaultValue, props.schema, outer)}
    />
  );
};

export { DefaultComponent as component };
