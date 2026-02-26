import React from "react";
import z from "zod";
import { Dynamic, type ZodFormProps } from "@zodapp/zod-form-react/common";

type DefaultSchema = z.ZodDefault<z.ZodTypeAny>;

const DefaultComponent = (props: ZodFormProps<DefaultSchema>) => {
  return (
    <Dynamic
      {...props}
      schema={props.schema.def.innerType}
      required={false}
      defaultValue={props.defaultValue ?? null}
    />
  );
};

export { DefaultComponent as component };
