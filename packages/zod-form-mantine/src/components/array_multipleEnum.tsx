import React, { useCallback, useEffect, useMemo } from "react";
import { InputWrapper, MultiSelect } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useRunAsUserEdit,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  renderSelectOption,
  useEnumData,
  toEnumOptionValue,
  fromEnumOptionValue,
  normalizeStringSuggestions,
  ReadonlyText,
  UNLISTED_LABEL,
  inputWrapperStyle,
  type OptionDataType,
} from "@zodapp/zod-form-mantine-lite/utils";
import type z from "zod";

type EnumSchema = ReturnType<typeof zf.enum>;

type ArrayOfEnumSchema = ReturnType<
  typeof zf.array<ReturnType<typeof zf.enum>>
>;

const EMPTY_SUGGESTIONS: never[] = [];

// 要素が enum でないときに useEnumData へ渡す、選択肢 0 件の enum
const NO_ENUM_OPTIONS = zf.enum(
  [] as unknown as [z.ZodLiteral<string>],
) as unknown as EnumSchema;

/**
 * 複数選択の欄。要素は enum。
 * 要素が `uiType: "select"` の string（externalKey の allowUnlisted から作るもの）なら、
 * suggestions から選び、選択肢に無い値も値そのものの表示で残す（検証は string のまま）
 */
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

    const elementSchema = schema.element as z.ZodTypeAny;
    const elementMeta = getMeta(elementSchema) as
      | {
          uiType?: string;
          suggestions?: Parameters<typeof normalizeStringSuggestions>[0];
          unlisted?: "keep" | "clear";
          emptyMessage?: string;
        }
      | undefined;
    // 選択肢に無い値も通す（string + suggestions）
    const allowUnlisted =
      elementSchema.type === "string" && elementMeta?.uiType === "select";

    if (elementSchema.type !== "enum" && !allowUnlisted) {
      throw new Error(
        `ArrayOfEnumComponent: Expected ZodEnum as internal type, but got ${elementSchema.type}`,
      );
    }
    const enumSchema = allowUnlisted
      ? NO_ENUM_OPTIONS
      : (elementSchema as EnumSchema);

    // arrayスキーマ自体のメタからlabelを取得
    const arrayMeta = getMeta(schema);
    const labelFromMeta = arrayMeta?.label;

    const uiType = arrayMeta?.uiType;
    const label = labelFromParent ?? labelFromMeta;
    const { unlisted, emptyMessage } = elementMeta ?? {};
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
    const fromOptionValues = useCallback(
      (next: string[]) =>
        next.length === 0
          ? undefined
          : allowUnlisted
            ? next
            : next.map((item) => fromEnumOptionValue(enumSchema, item)),
      [allowUnlisted, enumSchema],
    );
    const onChange = useCallback(
      (next: string[] | null | undefined) => {
        field.onChange(fromOptionValues(next ?? []));
      },
      [field, fromOptionValues],
    );

    const enumData = useEnumData(enumSchema);
    const suggestions = allowUnlisted
      ? elementMeta?.suggestions
      : EMPTY_SUGGESTIONS;
    const suggestionData = useMemo<OptionDataType[]>(
      () =>
        normalizeStringSuggestions(suggestions).map((option) => ({
          ...option,
          color: "gray",
        })),
      [suggestions],
    );
    const data = allowUnlisted ? suggestionData : enumData;

    // 選択肢に無い値（選択肢が変わって外れた、保存済みの値が選択肢から消えていたなど）の扱いは
    // 単一選択の enum の欄と同じく、要素の meta の unlisted で決める
    // - clear（既定）：選択肢に無い要素を消す。利用者の編集として書き、欄を「触った」「変えた」にはしない
    // - keep：要素を残し、「（不正な値）」と出して、触っていなくてもエラーを出す。× で消せる
    // allowUnlisted なら、選択肢に無い値も正しい値なので、値そのものを出して残す
    const unlistedValues = useMemo(
      () => value.filter((item) => !data.some((d) => d.value === item)),
      [value, data],
    );
    const hasUnlisted = unlistedValues.length > 0;
    const shouldClear =
      hasUnlisted && !allowUnlisted && unlisted !== "keep" && !readOnly;
    const runAsUserEdit = useRunAsUserEdit();
    useEffect(() => {
      if (!shouldClear) return;
      const form = field.api.form;
      const listed = value.filter((item) => !unlistedValues.includes(item));
      runAsUserEdit(() =>
        form.setFieldValue(
          field.api.name,
          fromOptionValues(listed) as never,
          // 欄の検証（validateField）は欄を「触った」にするので使わない
          { dontUpdateMeta: true, dontValidate: true },
        ),
      );
      // 消したあとの値でエラーを出し直す。フォームの検証は欄を「触った」にしない
      form.validateSync("change");
    }, [
      shouldClear,
      field,
      value,
      unlistedValues,
      fromOptionValues,
      runAsUserEdit,
    ]);
    const showUnlisted = hasUnlisted && !allowUnlisted && !shouldClear;

    // 選択肢に無い値を、選択肢として足す（足さないと MultiSelect は値を出さない）。
    // 選べない選択肢にすると Pill の × が出ず、1 つずつ消せないので、選べる選択肢のままにする
    // （外すと選択肢からも消えるので、選び直すことはできない）
    const selectData = useMemo<OptionDataType[]>(
      () =>
        hasUnlisted && !shouldClear
          ? [
              ...data,
              ...unlistedValues.map((item) =>
                allowUnlisted
                  ? { value: item, label: item, color: "gray" }
                  : {
                      value: item,
                      label: UNLISTED_LABEL,
                      color: "red",
                    },
              ),
            ]
          : data,
      [data, hasUnlisted, shouldClear, unlistedValues, allowUnlisted],
    );
    // 選択肢に無い値は、触ったかどうかに関係なく、何が悪いかが分かる文言で出す
    const errorMessage = showUnlisted
      ? "選択肢に無い値があります。消すか、選び直してください。"
      : error?.message;

    const displayLabels = useMemo(() => {
      return value
        .map((v) => {
          const option = selectData.find((d) => d.value === v);
          return option?.label ?? (allowUnlisted ? v : UNLISTED_LABEL);
        })
        .join(", ");
    }, [selectData, value, allowUnlisted]);

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

    // 選択肢が0件（上の欄が未選択など）なら、選べないことを示す。理由は要素の meta の emptyMessage で書ける。
    // 値は unlisted に従う（既定 clear なら消える。keep なら「（不正な値）」が残る）
    if (selectData.length === 0) {
      return (
        <MultiSelect
          ref={ref}
          value={[]}
          data={[]}
          label={label || undefined}
          placeholder={emptyMessage ?? "選択肢がありません"}
          error={error?.message}
          required={required !== false}
          disabled={true}
          style={inputWrapperStyle}
        />
      );
    }

    return (
      <MultiSelect
        ref={ref}
        value={value}
        data={selectData}
        renderOption={
          uiType === "multipleEnumBudge" ? renderSelectOption : undefined
        }
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        placeholder={data.length === 0 ? emptyMessage : undefined}
        error={errorMessage}
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
