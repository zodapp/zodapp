import React from "react";
import z from "zod";
import {
  Switch,
  addOuter,
  useResolveText,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";

type PipeSchema = z.ZodPipe<z.ZodTypeAny, z.ZodTypeAny>;

/**
 * pipe（`.transform()`・`.pipe()`・`z.codec()`・`z.stringbool()`）は、入口（`def.in`）の schema で描く。
 * フォームの値は入口の型で持ち、検証（pipe 全体の parse）も入口の型の値を受け取るため。
 * 出口の型への変換は、送信のときの parse で行う。
 *
 * - 入口がさらに pipe なら、同じ部品でたどる
 * - preprocess（入口が transform）は、Switch の手前（PreprocessSwitch）で扱うので、ここには来ない
 * - pipe 自体に付いた検査（`.refine()` など）は、outer で中に渡す（default の部品と同じ）
 * - pipe に付けた label は、入口の schema に label が無いときに使う
 */
const PipeComponent = (props: ZodFormProps<PipeSchema>) => {
  const { schema } = props;
  const resolveText = useResolveText();
  const inSchema = schema.def.in;
  const label =
    props.label ??
    (getMeta(inSchema)?.label === undefined
      ? resolveText(getMeta(schema)?.label)
      : undefined);
  return (
    <Switch
      {...props}
      schema={inSchema}
      outer={addOuter(props.outer, schema)}
      label={label}
    />
  );
};

export { PipeComponent as component };
