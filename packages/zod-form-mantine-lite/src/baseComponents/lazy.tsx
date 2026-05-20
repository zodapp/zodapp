import React, { useMemo } from "react";
import z from "zod";
import { Switch, type ZodFormProps } from "@zodapp/zod-form-react/common";

type LazySchema = z.ZodLazy<z.ZodTypeAny>;

const LazyComponent = (props: ZodFormProps<LazySchema>) => {
  const schema = useMemo(
    () => props.schema.def.getter() as z.ZodTypeAny,
    [props.schema],
  );
  return <Switch {...props} schema={schema} required={false} />;
};

export { LazyComponent as component };
