import React, { useCallback, useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useSchemaValueAction,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  ReadonlyText,
  WithValueAction,
  inputWrapperStyle,
  normalizeStringSuggestions,
} from "@zodapp/zod-form-mantine-lite/utils";

type StringSchema = z.ZodString;

/**
 * `uiType: "select"` の string。suggestions から選ぶ形で描画する。
 * 検証は string のままなので、選択肢に無い保存値もそのまま表示する。
 */
const StringSelectComponent = wrapComponent(
  function StringSelectComponentImplement({
    schema,
    field,
    label: labelFromParent,
    optional,
    readOnly,
    error,
  }: ZodFormInternalProps<StringSchema>) {
    const { onFocus, ref } = useValidatePrecedingFields(field);
    const { label: labelFromMeta, suggestions } =
      getMeta(schema, "string") ?? {};
    const label = labelFromParent ?? labelFromMeta;
    const value = typeof field.value === "string" ? field.value : null;
    const actionWrapper = useSchemaValueAction(schema, value);

    // 選択肢に無い保存値も選んだ状態で見えるように、選択肢へ足す
    const data = useMemo(() => {
      const normalized = normalizeStringSuggestions(suggestions);
      if (value && !normalized.some((option) => option.value === value)) {
        return [...normalized, { label: value, value }];
      }
      return normalized;
    }, [suggestions, value]);

    const displayLabel = useMemo(
      () => data.find((option) => option.value === value)?.label ?? value ?? "",
      [data, value],
    );

    const onChange = useCallback(
      (next: string | null) => {
        field.onChange(next || undefined);
      },
      [field],
    );

    if (readOnly || field.disabled) {
      return (
        <InputWrapper
          label={label || undefined}
          labelElement="div"
          style={inputWrapperStyle}
        >
          <WithValueAction
            wrapper={actionWrapper}
            label={label || undefined}
            align="center"
          >
            <ReadonlyText>{displayLabel}</ReadonlyText>
          </WithValueAction>
        </InputWrapper>
      );
    }

    return (
      <WithValueAction wrapper={actionWrapper} label={label || undefined}>
        <Select
          ref={ref}
          value={value}
          data={data}
          onChange={onChange}
          onBlur={field.onBlur}
          onFocus={onFocus}
          label={label || undefined}
          searchable={true}
          error={error?.message}
          required={!optional}
          allowDeselect={true}
          clearable={true}
          style={inputWrapperStyle}
        />
      </WithValueAction>
    );
  },
);

StringSelectComponent.displayName = "StringSelectComponent";

export { StringSelectComponent as component };
