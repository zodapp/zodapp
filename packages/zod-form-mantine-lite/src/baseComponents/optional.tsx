import React from "react";
import z from "zod";
import {
  Switch,
  addOuter,
  innerDefaultValue,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { ResetLazyDepth } from "./lazy";

type OptionalSchema = z.ZodOptional<z.ZodTypeAny>;

const OptionalComponent = (props: ZodFormProps<OptionalSchema>) => {
  const outer = addOuter(props.outer, props.schema);
  // 値が無ければ中を描かない（object なら ＋ だけ）ので、lazy の数を数え直す
  return (
    <ResetLazyDepth>
      <Switch
        {...props}
        schema={props.schema.def.innerType}
        outer={outer}
        defaultValue={innerDefaultValue(
          props.defaultValue,
          props.schema,
          outer,
        )}
      />
    </ResetLazyDepth>
  );
};

export { OptionalComponent as component };
