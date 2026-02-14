import React from "react";
import { Slider, InputWrapper } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta, extractCheck } from "@zodapp/zod-form";
import { $ZodCheckMultipleOfDef } from "zod/v4/core";
import { ReadonlyText } from "./utils/text";

type NumberSchema = ReturnType<typeof zf.number>;

const NumberSliderComponent = wrapComponent(
  function NumberSliderComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<NumberSchema>) {
    const { onFocus, ref } = useValidatePrecedingFields(field);
    const { label: labelFromMeta } = getMeta(schema) ?? {};
    const label = labelFromParent ?? labelFromMeta;
    const value =
      typeof field.value === "number" ? field.value : (schema.minValue ?? 0);
    const step = Number(
      extractCheck<$ZodCheckMultipleOfDef>(schema.def.checks, "multiple_of")
        ?.value ?? 1,
    );

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{value}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <InputWrapper
        label={label || undefined}
        required={required !== false}
        error={error?.message}
        style={{ marginBottom: 10 }}
        labelElement="div"
        mt={5}
      >
        <div style={{ paddingTop: 3, paddingBottom: 10 }}>
          <Slider
            ref={ref}
            value={value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            onFocus={onFocus}
            disabled={readOnly || field.disabled}
            min={schema.minValue ?? undefined}
            max={schema.maxValue ?? undefined}
            step={step}
            thumbSize={28}
            mt={8}
            ml={8}
            mr={8}
          />
        </div>
      </InputWrapper>
    );
  },
);

export { NumberSliderComponent as component };
