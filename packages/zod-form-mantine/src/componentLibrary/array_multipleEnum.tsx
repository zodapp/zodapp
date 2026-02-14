import React, { useCallback, useMemo } from "react";
import { InputWrapper, MultiSelect } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { renderSelectOption } from "./utils/selectOption";
import { useEnumData } from "./utils/enum";
import { ReadonlyText } from "./utils/text";

type EnumSchema = ReturnType<typeof zf.enum>;

type ArrayOfEnumSchema = ReturnType<
  typeof zf.array<ReturnType<typeof zf.enum>>
>;

const ArrayOfEnumComponent = wrapComponent(
  function ArrayOfEnumComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<ArrayOfEnumSchema>) {
    const { onFocus, ref } = useValidatePrecedingFields(field);

    const enumSchema = schema.element as EnumSchema;

    if (enumSchema.type !== "enum") {
      throw new Error(
        `ArrayOfEnumComponent: Expected ZodEnum as internal type, but got ${enumSchema.type}`,
      );
    }

    // arrayスキーマ自体のメタからlabelを取得
    const arrayMeta = getMeta(schema);
    const labelFromMeta = arrayMeta?.label;

    const uiType = arrayMeta?.uiType;
    const label = labelFromParent ?? labelFromMeta;
    const value = useMemo(
      () => (Array.isArray(field.value) ? field.value : []),
      [field.value],
    );
    const onChange = useCallback(
      (next: string[] | null | undefined) => {
        field.onChange(!next || next.length === 0 ? undefined : next);
      },
      [field],
    );

    const data = useEnumData(enumSchema);

    const displayLabels = useMemo(() => {
      return value
        .map((v) => {
          const option = data.find((d) => d.value === v);
          return option?.label ?? String(v);
        })
        .join(", ");
    }, [data, value]);

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{displayLabels}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <MultiSelect
        ref={ref}
        value={value}
        data={data}
        renderOption={
          uiType === "multipleEnumBudge" ? renderSelectOption : undefined
        }
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        clearable={true}
        searchable={true}
        mt={5}
      />
    );
  },
);

export { ArrayOfEnumComponent as component };
