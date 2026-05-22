import React from "react";
import z from "zod";
import { Switch, type ZodFormProps } from "@zodapp/zod-form-react/common";

type PipeSchema = z.ZodPipe<z.ZodTypeAny, z.ZodTypeAny>;

const PipeComponent = (props: ZodFormProps<PipeSchema>) => {
  return <Switch {...props} schema={props.schema.def.out} />;
};

export { PipeComponent as component };
