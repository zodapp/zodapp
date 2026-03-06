import React, { useCallback, useMemo } from "react";
import { InputWrapper, Pill, TagsInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
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

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} style={inputWrapperStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--mantine-spacing-xs)",
              minHeight: "var(--input-size-sm)",
              paddingInline: "calc(var(--mantine-spacing-xs) + 2px)",
              paddingBlock: "calc(var(--mantine-spacing-xs) - 2px)",
              border: "1px solid var(--mantine-color-gray-4)",
              borderRadius: "var(--mantine-radius-default)",
              backgroundColor: "var(--mantine-color-white)",
            }}
          >
            {value.length > 0 ? (
              <Pill.Group>
                {value.map((item, index) => (
                  <Pill key={`${item}-${index}`}>{item}</Pill>
                ))}
              </Pill.Group>
            ) : (
              "-"
            )}
          </div>
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
        style={inputWrapperStyle}
      />
    );
  },
);

export { ArrayOfStringComponent as component };
