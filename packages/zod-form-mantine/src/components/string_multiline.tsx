import React, { useCallback } from "react";
import { Button, Group, InputWrapper, Textarea } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  ReadonlyText,
  inputWrapperStyle,
  renderComputedValue,
} from "@zodapp/zod-form-mantine-lite/utils";
import multilineStyles from "@zodapp/zod-form-mantine-lite/utils/stringMultiline.module.css";
import { normalizeStringSuggestions } from "./stringSuggestions.js";

type StringSchema = z.ZodString;

const StringMultilineComponent = wrapComponent(
  function StringMultilineComponentImplement({
    schema,
    field,
    label: labelFromParent,
    required,
    readOnly,
    error,
  }: ZodFormInternalProps<StringSchema>) {
    const { onFocus, ref } = useValidatePrecedingFields(field);
    const { label: labelFromMeta, formatter, suggestions } =
      getMeta(schema, "string") ?? {};
    const label = labelFromParent ?? labelFromMeta;
    const suggestionData = normalizeStringSuggestions(suggestions);

    const value = typeof field.value === "string" ? field.value : "";

    const onChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        field.onChange(event.target.value || undefined);
      },
      [field],
    );

    const setSuggestionValue = useCallback(
      (nextValue: string) => {
        field.onChange(nextValue || undefined);
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
          required={required !== false}
          disabled={readOnly || field.disabled}
          style={inputWrapperStyle}
          autosize
          minRows={3}
          classNames={{ input: multilineStyles.input }}
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
