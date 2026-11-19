import React from "react";
import z from "zod";
import {
  Switch,
  addOuter,
  innerDefaultValue,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";

/**
 * 包みを外して中を描く部品（`.readonly()`・`.catch()`・`.nonoptional()`・`.prefault()`）。
 *
 * - readonly：中をそのまま描く（zod の readonly は値を凍らせるだけで、入力の可否ではない）
 * - catch：中をそのまま描く。検証は zod に任せる（送信の parse で catch の値に置き換わる）
 * - nonoptional：外側の optional を打ち消し、中を必須として描く（{@link addOuter}）
 * - prefault：中をそのまま描く。値が無ければ prefault の値を入れる（{@link innerDefaultValue}）
 */
type PassthroughSchema = z.ZodType & { def: { innerType: z.ZodTypeAny } };

const PassthroughComponent = (props: ZodFormProps<PassthroughSchema>) => {
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

export { PassthroughComponent as component };
