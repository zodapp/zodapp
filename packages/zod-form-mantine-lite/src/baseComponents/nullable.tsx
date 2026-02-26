import React from "react";
import z from "zod";
import { Dynamic, type ZodFormProps } from "@zodapp/zod-form-react/common";

type NullableSchema = z.ZodNullable<z.ZodTypeAny>;

const NullableComponent = (props: ZodFormProps<NullableSchema>) => {
  return (
    <Dynamic
      {...props}
      schema={props.schema.def.innerType}
      required={false}
      defaultValue={props.defaultValue ?? null}
    />
  );
};

export { NullableComponent as component };
