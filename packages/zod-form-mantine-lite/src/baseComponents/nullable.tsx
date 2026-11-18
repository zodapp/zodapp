import React from "react";
import z from "zod";
import {
  Switch,
  addOuter,
  innerDefaultValue,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";

type NullableSchema = z.ZodNullable<z.ZodTypeAny>;

const NullableComponent = (props: ZodFormProps<NullableSchema>) => {
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

export { NullableComponent as component };
