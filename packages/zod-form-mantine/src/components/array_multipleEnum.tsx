import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useCallback, useEffect, useMemo } from "react";
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
  useRunAsUserEdit,
  emptinessOf,
  emptyValueOf,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  renderBadge,
  renderSelectOption,
  useChoices,
  normalizeStringSuggestions,
  ReadonlyText,
  useUnlistedLabel,
  inputWrapperStyle,
  type OptionDataType,
} from "@zodapp/zod-form-mantine-lite/utils";
import type z from "zod";
import { useMsg } from "../messages/useMsg";
import { withSupportCheck } from "../utils/unsupported";
import { arrayCollection, type Collection } from "../utils/collection";
import { useResolveText } from "@zodapp/zod-form-react/common";

type EnumSchema = ReturnType<typeof zf.enum>;

type ArrayOfEnumSchema = ReturnType<
  typeof zf.array<ReturnType<typeof zf.enum>>
>;

const EMPTY_SUGGESTIONS: never[] = [];

// 要素が enum・literal の union でないときに useChoices へ渡す、選択肢 0 件の enum
const NO_ENUM_OPTIONS = zf.enum(
  [] as unknown as [z.ZodLiteral<string>],
) as unknown as EnumSchema;

/**
 * 複数選択の欄。要素は enum か、literal だけの union（腕の番号で MultiSelect とやりとりする）。
 * 要素が `uiType: "select"` の string（externalKey の allowUnlisted から作るもの）なら、
 * suggestions から選び、選択肢に無い値も値そのものの表示で残す（検証は string のまま）
 */
export const createMultipleEnumComponent = (collection: Collection) =>
  wrapComponent(function MultipleEnumComponentImplement({
    schema,
    label: labelFromParent,
    outer,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<ArrayOfEnumSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const { onFocus, ref } = useValidatePrecedingFields(field);

    const elementSchema = collection.elementOf(schema);
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

    const choiceSchema = allowUnlisted
      ? NO_ENUM_OPTIONS
      : (elementSchema as EnumSchema);
    const choices = useChoices(choiceSchema);

    // arrayスキーマ自体のメタからlabelを取得
    const arrayMeta = useResolvedMeta(schema);
    const labelFromMeta = arrayMeta?.label;

    const uiType = arrayMeta?.uiType;
    const label = labelFromParent ?? labelFromMeta;
    const { unlisted } = elementMeta ?? {};
    const msg = useMsg();
    const resolveText = useResolveText();
    const unlistedLabel = useUnlistedLabel();
    const emptyMessage = resolveText(elementMeta?.emptyMessage);
    // 数値の選択肢も扱えるよう、MultiSelect とは文字列でやりとりする
    // 今の値の要素を、選択肢の値ごとに引けるようにしておく（選択肢に無い値を keep で残すとき、
    // 選択肢の値からは元の値に戻せないため）
    const { value, currentByOption } = useMemo(() => {
      const value: string[] = [];
      const currentByOption = new Map<string, unknown>();
      for (const item of collection.toItems(field.value)) {
        const optionValue = choices.toOption(item);
        if (optionValue === null) continue;
        value.push(optionValue);
        currentByOption.set(optionValue, item);
      }
      return { value, currentByOption };
    }, [field.value, choices]);
    const emptyValue = emptyValueOf({ optional, nullable });
    const fromOptionValues = useCallback(
      (next: string[]) =>
        next.length === 0
          ? emptyValue
          : collection.fromItems(
              allowUnlisted
                ? next
                : next.map((item) =>
                    currentByOption.has(item)
                      ? currentByOption.get(item)
                      : choices.fromOption(item),
                  ),
            ),
      [allowUnlisted, choices, currentByOption, emptyValue],
    );
    const onChange = useCallback(
      (next: string[] | null | undefined) => {
        field.onChange(fromOptionValues(next ?? []));
      },
      [field, fromOptionValues],
    );

    const enumData = choices.data;
    const suggestions = allowUnlisted
      ? elementMeta?.suggestions
      : EMPTY_SUGGESTIONS;
    const suggestionData = useMemo<OptionDataType[]>(
      () =>
        normalizeStringSuggestions(suggestions, resolveText).map((option) => ({
          ...option,
          color: "gray",
        })),
      [suggestions, resolveText],
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
                      label: unlistedLabel,
                      color: "red",
                    },
              ),
            ]
          : data,
      [
        data,
        hasUnlisted,
        shouldClear,
        unlistedValues,
        allowUnlisted,
        unlistedLabel,
      ],
    );
    // 選択肢に無い値は、触ったかどうかに関係なく、何が悪いかが分かる文言で出す
    const errorMessage = showUnlisted
      ? msg(
          "zodFormMantine.multipleEnum.unlisted" /* 選択肢に無い値があります。消すか、選び直してください。 */,
        )
      : error?.message;

    const isBadge = uiType === "multipleEnumBadge";

    const displayLabels = useMemo(() => {
      // badge は選択肢の色でバッジを並べる（選択肢に無い値は、バッジにせず文字のまま
      // 「（不正な値）」、allowUnlisted なら値そのもの）
      if (isBadge) {
        return (
          <Group gap={4}>
            {value.map((v) => {
              const option = data.find((d) => d.value === v);
              return (
                <React.Fragment key={v}>
                  {option
                    ? renderBadge(option)
                    : allowUnlisted
                      ? v
                      : unlistedLabel}
                </React.Fragment>
              );
            })}
          </Group>
        );
      }
      return value
        .map((v) => {
          const option = selectData.find((d) => d.value === v);
          return option?.label ?? (allowUnlisted ? v : unlistedLabel);
        })
        .join(", ");
    }, [data, selectData, value, allowUnlisted, isBadge, unlistedLabel]);

    // 選択済みのピルも選択肢の色のバッジにする（× で外せる）。
    // 選択肢に無い値も selectData に足してあるので、そのラベル・色で出る
    const renderPill = useCallback<NonNullable<MultiSelectProps["renderPill"]>>(
      ({ option, onRemove, disabled }) => {
        const found = selectData.find((d) => d.value === String(option.value));
        return renderBadge(found ?? option, {
          style: { textTransform: "none" },
          rightSection:
            !disabled && onRemove ? (
              <CloseButton
                size="xs"
                variant="transparent"
                c="inherit"
                aria-label={msg(
                  "zodFormMantine.multipleEnum.remove" /* ${label}を外す */,
                  { label: option.label },
                )}
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
      [selectData],
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

    // 選択肢が0件（上の欄が未選択など）なら、選べないことを示す。理由は要素の meta の emptyMessage で書ける。
    // 値は unlisted に従う（既定 clear なら消える。keep なら「（不正な値）」が残る）
    if (selectData.length === 0) {
      return (
        <MultiSelect
          ref={ref}
          value={[]}
          data={[]}
          label={label || undefined}
          placeholder={
            emptyMessage ??
            msg("zodFormMantineLite.noOptions" /* 選択肢がありません */)
          }
          error={error?.message}
          required={!(optional || nullable)}
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
        renderOption={isBadge ? renderSelectOption : undefined}
        renderPill={isBadge ? renderPill : undefined}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        placeholder={data.length === 0 ? emptyMessage : undefined}
        error={errorMessage}
        required={!(optional || nullable)}
        disabled={readOnly || field.disabled}
        clearable={true}
        searchable={true}
        style={inputWrapperStyle}
      />
    );
  });

/** 要素が選択肢として扱えるか。扱えなければ理由（開発者向け）を返す */
export const checkChoiceElement = (
  elementSchema: z.ZodTypeAny,
  uiTypeName: string,
): string | undefined => {
  const elementMeta = getMeta(elementSchema) as { uiType?: string } | undefined;
  if (
    elementSchema.type === "enum" ||
    elementSchema.type === "union" ||
    elementSchema.type === "literal"
  )
    return;
  if (elementSchema.type === "string" && elementMeta?.uiType === "select")
    return;
  return `${uiTypeName} expects elements of enum, literal, or union of literals, but the element is ${elementSchema.type}`;
};

const ArrayOfEnumComponent = createMultipleEnumComponent(arrayCollection);

const CheckedArrayOfEnumComponent = withSupportCheck(
  ArrayOfEnumComponent,
  (schema: ArrayOfEnumSchema) =>
    checkChoiceElement(schema.element as z.ZodTypeAny, 'uiType "multipleEnum"'),
);

export { CheckedArrayOfEnumComponent as component };
