import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useCallback } from "react";
import { Autocomplete, InputWrapper, TextInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useSchemaValueAction,
  emptyValueOf,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import z from "zod";
import {
  ReadonlyText,
  WithValueAction,
  inputWrapperStyle,
  normalizeStringSuggestions,
  renderComputedValue,
} from "@zodapp/zod-form-mantine-lite/utils";

type StringSchema = z.ZodString;

const StringComponent = wrapComponent(function StringComponentImplement({
  schema,
  field,
  label: labelFromParent,
  outer,
  readOnly,
  error,
}: ZodFormInternalProps<StringSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const {
    label: labelFromMeta,
    formatter,
    suggestions,
    placeholder,
  } = useResolvedMeta(schema, "string") ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const suggestionData = normalizeStringSuggestions(suggestions);

  const value = typeof field.value === "string" ? field.value : "";
  const actionWrapper = useSchemaValueAction(schema, value);

  const emptyValue = emptyValueOf({ optional, nullable });
  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      field.onChange(event.target.value || emptyValue);
    },
    [field, emptyValue],
  );

  const onAutocompleteChange = useCallback(
    (nextValue: string) => {
      field.onChange(nextValue || emptyValue);
    },
    [field, emptyValue],
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
          {value && formatter ? (
            renderComputedValue(formatter(value), "readOnly")
          ) : (
            <ReadonlyText>{value}</ReadonlyText>
          )}
        </WithValueAction>
      </InputWrapper>
    );
  }

  const input =
    suggestionData.length > 0 ? (
      <Autocomplete
        ref={ref}
        value={value}
        data={suggestionData}
        onChange={onAutocompleteChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        placeholder={placeholder}
        error={error?.message}
        required={!(optional || nullable)}
        disabled={readOnly || field.disabled}
        style={inputWrapperStyle}
      />
    ) : (
      <TextInput
        ref={ref}
        value={value}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        placeholder={placeholder}
        error={error?.message}
        required={!(optional || nullable)}
        disabled={readOnly || field.disabled}
        style={inputWrapperStyle}
      />
    );

  return (
    <WithValueAction wrapper={actionWrapper} label={label || undefined}>
      {input}
    </WithValueAction>
  );
});

StringComponent.displayName = "StringComponent";

export { StringComponent as component };
