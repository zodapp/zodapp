import React from "react";
import z from "zod";
import {
  Switch,
  addOuter,
  innerDefaultValue,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { ResetLazyDepth } from "./lazy";

type NullableSchema = z.ZodNullable<z.ZodTypeAny>;

const NullableComponent = (props: ZodFormProps<NullableSchema>) => {
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

export { NullableComponent as component };
