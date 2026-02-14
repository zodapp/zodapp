import React, { useCallback, useMemo } from "react";
import { InputWrapper, TagsInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "./utils/text";
import type z from "zod";

type ArrayOfStringSchema = z.ZodArray<z.ZodString>;

const ArrayOfStringComponent = wrapComponent(
  function ArrayOfStringComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<ArrayOfStringSchema>) {
    const { onFocus, ref } = useValidatePrecedingFields(field);

    // arrayスキーマ自体のメタからlabelを取得
    const arrayMeta = getMeta(schema);
    const labelFromMeta = arrayMeta?.label;
    const label = labelFromParent ?? labelFromMeta;

    const value = useMemo(
      () => (Array.isArray(field.value) ? field.value : []),
      [field.value],
    );

    const onChange = useCallback(
      (next: string[]) => {
        field.onChange(next.length === 0 ? undefined : next);
      },
      [field],
    );

    const displayValue = useMemo(() => value.join(", "), [value]);

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{displayValue}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <TagsInput
        ref={ref}
        value={value}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        placeholder="タグを入力してEnterで追加"
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        clearable={true}
        splitChars={[",", " ", "|"]}
        mt={5}
      />
    );
  },
);

export { ArrayOfStringComponent as component };
