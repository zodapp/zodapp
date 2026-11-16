import React, { useCallback } from "react";
import { Button, Group, InputWrapper, Textarea } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useEmptiness,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  ReadonlyText,
  inputWrapperStyle,
  renderComputedValue,
  stringMultilineStyles,
} from "@zodapp/zod-form-mantine-lite/utils";
import { normalizeStringSuggestions } from "@zodapp/zod-form-mantine-lite/utils";

type StringSchema = z.ZodString;

const StringMultilineComponent = wrapComponent(
  function StringMultilineComponentImplement({
    fieldPath,
    schema,
    field,
    label: labelFromParent,
    readOnly,
    error,
  }: ZodFormInternalProps<StringSchema>) {
    const { optional, nullable, emptyValue } = useEmptiness(fieldPath);
    const { onFocus, ref } = useValidatePrecedingFields(field);
    const {
      label: labelFromMeta,
      formatter,
      suggestions,
    } = getMeta(schema, "string") ?? {};
    const label = labelFromParent ?? labelFromMeta;
    const suggestionData = normalizeStringSuggestions(suggestions);

    const value = typeof field.value === "string" ? field.value : "";
    const onChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        field.onChange(event.target.value || emptyValue);
      },
      [field, emptyValue],
    );

    const setSuggestionValue = useCallback(
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
          {value && formatter ? (
            renderComputedValue(formatter(value), "readOnly")
          ) : (
            <ReadonlyText style={{ whiteSpace: "pre-wrap" }}>
              {value}
            </ReadonlyText>
          )}
        </InputWrapper>
      );
    }

    return (
      <>
        <Textarea
          ref={ref}
          value={value}
          onChange={onChange}
          onBlur={field.onBlur}
          onFocus={onFocus}
          label={label || undefined}
          error={error?.message}
          required={!(optional || nullable)}
          disabled={readOnly || field.disabled}
          style={inputWrapperStyle}
          autosize
          minRows={3}
          styles={stringMultilineStyles}
        />
        {suggestionData.length > 0 && (
          <Group gap="xs" mt="xs">
            {suggestionData.map((suggestion) => (
              <Button
                key={suggestion.value}
                type="button"
                size="xs"
                variant="light"
                onClick={() => setSuggestionValue(suggestion.value)}
              >
                {suggestion.label}
              </Button>
            ))}
          </Group>
        )}
      </>
    );
  },
);

StringMultilineComponent.displayName = "StringMultilineComponent";

export { StringMultilineComponent as component };
