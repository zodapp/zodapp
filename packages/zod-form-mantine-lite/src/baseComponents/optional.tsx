import React from "react";
import z from "zod";
import { Dynamic, type ZodFormProps } from "@zodapp/zod-form-react/common";

type OptionalSchema = z.ZodOptional<z.ZodTypeAny>;

const OptionalComponent = (props: ZodFormProps<OptionalSchema>) => {
  return (
    <Dynamic
      {...props}
      schema={props.schema.def.innerType}
      required={false}
      defaultValue={props.defaultValue}
    />
  );
};

export { OptionalComponent as component };
