import React, { useCallback, useMemo } from "react";
import {
  CloseButton,
  Group,
  InputWrapper,
  MultiSelect,
  type MultiSelectProps,
} from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  renderBadge,
  renderSelectOption,
  useEnumData,
  toEnumOptionValue,
  fromEnumOptionValue,
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

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
    // 数値の選択肢も扱えるよう、MultiSelect とは文字列でやりとりする
    const value = useMemo(
      () =>
        Array.isArray(field.value)
          ? field.value.flatMap((item: unknown) => {
              const optionValue = toEnumOptionValue(item);
              return optionValue === null ? [] : [optionValue];
            })
          : [],
      [field.value],
    );
    const onChange = useCallback(
      (next: string[] | null | undefined) => {
        field.onChange(
          !next || next.length === 0
            ? undefined
            : next.map((item) => fromEnumOptionValue(enumSchema, item)),
        );
      },
      [enumSchema, field],
    );

    const data = useEnumData(enumSchema);

    const isBadge = uiType === "multipleEnumBadge";

    const displayLabels = useMemo(() => {
      // badge は選択肢の色でバッジを並べる（選択肢に無い値は文字のまま）
      if (isBadge) {
        return (
          <Group gap={4}>
            {value.map((v) => {
              const option = data.find((d) => d.value === v);
              return (
                <React.Fragment key={v}>
                  {option ? renderBadge(option) : v}
                </React.Fragment>
              );
            })}
          </Group>
        );
      }
      return value
        .map((v) => {
          const option = data.find((d) => d.value === v);
          return option?.label ?? String(v);
        })
        .join(", ");
    }, [data, value, isBadge]);

    // 選択済みのピルも選択肢の色のバッジにする（× で外せる）
    const renderPill = useCallback<NonNullable<MultiSelectProps["renderPill"]>>(
      ({ option, onRemove, disabled }) => {
        const found = data.find((d) => d.value === String(option.value));
        return renderBadge(found ?? option, {
          style: { textTransform: "none" },
          rightSection:
            !disabled && onRemove ? (
              <CloseButton
                size="xs"
                variant="transparent"
                c="inherit"
                aria-label={`${option.label}を外す`}
                // Mantine の Pill の削除ボタンと同じく、入れ物（PillsInput）の
                // mousedown / click（フォーカス・開閉）へ伝えない
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              />
            ) : undefined,
        });
      },
      [data],
    );

    if (readOnly || field.disabled) {
      return (
        <InputWrapper
          label={label || undefined}
          labelElement="div"
          style={inputWrapperStyle}
        >
          <ReadonlyText>{displayLabels}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <MultiSelect
        ref={ref}
        value={value}
        data={data}
        renderOption={isBadge ? renderSelectOption : undefined}
        renderPill={isBadge ? renderPill : undefined}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        clearable={true}
        searchable={true}
        style={inputWrapperStyle}
      />
    );
  },
);

export { ArrayOfEnumComponent as component };
