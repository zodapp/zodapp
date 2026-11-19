import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useCallback, useMemo } from "react";
import { InputWrapper, Pill, TagsInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  emptyValueOf,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import type z from "zod";
import { useMsg } from "../messages/useMsg";
import { withSupportCheck } from "../utils/unsupported";
import { arrayCollection, type Collection } from "../utils/collection";

type ArrayOfStringSchema = z.ZodArray<z.ZodString>;

export const createMultipleStringComponent = (collection: Collection) =>
  wrapComponent(function MultipleStringComponentImplement({
    schema,
    label: labelFromParent,
    outer,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<ArrayOfStringSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const { onFocus, ref } = useValidatePrecedingFields(field);
    const msg = useMsg();

    // arrayスキーマ自体のメタからlabelを取得
    const arrayMeta = useResolvedMeta(schema);
    const labelFromMeta = arrayMeta?.label;
    const label = labelFromParent ?? labelFromMeta;

    // 要素が number のとき（set のタグ入力）は、文字にして並べ、数に戻して書く
    const isNumber = collection.elementOf(schema).type === "number";
    const value = useMemo(
      () =>
        collection
          .toItems(field.value)
          .filter(
            (item): item is string | number =>
              typeof item === "string" || typeof item === "number",
          )
          .map(String),
      [field.value],
    );

    const emptyValue = emptyValueOf({ optional, nullable });
    const onChange = useCallback(
      (next: string[]) => {
        if (next.length === 0) {
          field.onChange(emptyValue);
          return;
        }
        const items: unknown[] = isNumber
          ? next.map(Number).filter((item) => !Number.isNaN(item))
          : next;
        // 重複は入れない（set では同じ値が 1 つになる。配列でも TagsInput は重複を入れない）
        field.onChange(collection.fromItems(Array.from(new Set(items))));
      },
      [field, emptyValue, isNumber],
    );

    if (readOnly || field.disabled) {
      return (
        <InputWrapper
          label={label || undefined}
          labelElement="div"
          style={inputWrapperStyle}
        >
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
        placeholder={msg(
          "zodFormMantine.multipleString.placeholder" /* 入力してEnterで追加 */,
        )}
        error={error?.message}
        required={!(optional || nullable)}
        disabled={readOnly || field.disabled}
        clearable={true}
        splitChars={[",", " ", "|"]}
        style={inputWrapperStyle}
      />
    );
  });

const ArrayOfStringComponent = createMultipleStringComponent(arrayCollection);

const CheckedArrayOfStringComponent = withSupportCheck(
  ArrayOfStringComponent,
  (schema) => {
    const elementType = (schema.element as z.ZodTypeAny).type;
    return elementType === "string"
      ? undefined
      : `uiType "multipleString" expects an array of string, but the element is ${elementType}`;
  },
);

export { CheckedArrayOfStringComponent as component };
