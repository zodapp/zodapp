import React from "react";
import { InputWrapper } from "@mantine/core";
import z from "zod";
import {
  ZodFormInternalProps,
  wrapComponent,
  Dynamic,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";

type TupleSchema = ReturnType<typeof zf.tuple>;

const TupleComponent = wrapComponent(function TupleComponentImplement({
  fieldPath,
  schema,
  defaultValue,
  required,
  readOnly,
  label: labelFromParent,
  error,
  field,
}: ZodFormInternalProps<TupleSchema>) {
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const baseItems = schema.def.items as z.ZodTypeAny[];
  const restSchema = schema.def.rest as z.ZodTypeAny | null;

  const fieldArray = Array.isArray(field.value) ? field.value : [];
  const defaultArray = Array.isArray(defaultValue) ? defaultValue : [];
  const length = Math.max(
    baseItems.length,
    fieldArray.length,
    defaultArray.length,
  );

  const entries = Array.from({ length }, (_, index) => {
    const itemSchema = baseItems[index] ?? restSchema;
    if (!itemSchema) return null;
    return (
      <Dynamic
        key={index}
        fieldPath={`${fieldPath}[${index}]`}
        schema={itemSchema as z.ZodTypeAny}
        defaultValue={defaultArray[index]}
        required={required}
        readOnly={readOnly}
        label={getMeta(itemSchema)?.label ?? false}
      />
    );
  }).filter(Boolean);

  return (
    <InputWrapper
      label={label || undefined}
      required={required !== false}
      error={error?.message}
      labelElement="div"
      mt={5}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries}
      </div>
    </InputWrapper>
  );
});

export { TupleComponent as component };
