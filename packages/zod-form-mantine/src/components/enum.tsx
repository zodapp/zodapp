import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useCallback, useEffect, useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import { useStore } from "@tanstack/react-form";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useSchemaValueAction,
  useRunAsUserEdit,
  emptyValueOf,
  emptinessOf,
  isPendingIssue,
} from "@zodapp/zod-form-react/common";
import { zf } from "@zodapp/zod-form";
import type z from "zod";
import {
  BadgeSelect,
  renderBadge,
  useChoices,
  isEmptyOption,
  ReadonlyText,
  WithValueAction,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";
import { useMsg } from "../messages/useMsg";
import { useUnlistedLabel } from "@zodapp/zod-form-mantine-lite/utils";

type EnumSchema = ReturnType<typeof zf.enum>;

const EMPTY_ERRORS: unknown[] = [];

const isUnionIssue = (issue: unknown) =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as { code?: unknown }).code === "invalid_union";

/**
 * 選択の欄。enum と、literal だけの union（`uiType: "select"`・`"badge"`）で使う。
 * union のときは、選択肢を腕の literal から作り、Select とは腕の番号でやりとりする（{@link useChoices}）
 */
const EnumComponent = wrapComponent(function EnumComponentImplement({
  schema,
  label: labelFromParent,
  outer,
  readOnly,
  field,
  error,
}: ZodFormInternalProps<EnumSchema>) {
  const outerEmptiness = emptinessOf(outer);
  const {
    label: labelFromMeta,
    uiType,
    unlisted,
    emptyMessage,
  } = useResolvedMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const msg = useMsg();
  const unlistedLabel = useUnlistedLabel();

  const choices = useChoices(schema);
  // 腕で表せる空の値は、外側の optional・nullable より腕を優先する（undefined の腕があれば
  // optional を、null の腕があれば nullable を無いものとする）。残ったもので ×・空の値・必須の印を決める
  const optional = outerEmptiness.optional && !choices.hasUndefined;
  const nullable = outerEmptiness.nullable && !choices.hasNull;
  // 外側の空を腕がすべて受け持つなら、× は出さない（× で書く値は、腕を選ぶのと同じになるため）
  const clearable = !(
    (outerEmptiness.optional || outerEmptiness.nullable) &&
    !(optional || nullable)
  );
  const emptyValue = emptyValueOf({ optional, nullable });
  const onChange = useCallback(
    (value: string | null | undefined) => {
      // 選んだ腕の値が null・undefined でも、空の値に置き換えずにそのまま書く
      field.onChange(
        isEmptyOption(value) ? emptyValue : choices.fromOption(value),
      );
    },
    [field, choices, emptyValue],
  );

  const data = choices.data;
  // 数値の選択肢も扱えるよう、Select とは文字列でやりとりする (0 も値として残す)
  const optionValue = choices.toOption(field.value);
  const actionWrapper = useSchemaValueAction(schema, optionValue);

  // 選択肢に無い値（選択肢が変わって外れた、保存済みの値が選択肢から消えていたなど）の扱いは
  // unlisted で決める。この部品だけが決める（dynamic の prune は選択肢から外れただけの値を残す）
  // - clear（既定）：消す。開いたときの保存値も消す。利用者の編集として書くので、下の dynamic へ連鎖する。
  //   欄を「触った」「変えた」にはしない（dontUpdateMeta・dontValidate）。必須のエラーは、ほかの欄と同じく
  //   触るか送信するまで出ず、開いただけで消しても isDirty は false のまま
  // - keep：空欄に見せると値が残っていることが分からないので、欄に「（不正な値）」と出し
  //   （ID などの生の値は見せない）、触っていなくてもエラーを出す。
  //   選べない選択肢として足すので、× で消せる（optional なら消せば保存できる）
  const isUnlisted =
    optionValue !== null && !data.some((d) => d.value === optionValue);
  const shouldClear = isUnlisted && unlisted !== "keep" && !readOnly;
  const runAsUserEdit = useRunAsUserEdit();
  useEffect(() => {
    if (!shouldClear) return;
    const form = field.api.form;
    runAsUserEdit(() =>
      form.setFieldValue(
        field.api.name,
        choices.fromOption(null) as never,
        // 欄の検証（validateField）は欄を「触った」にするので使わない
        { dontUpdateMeta: true, dontValidate: true },
      ),
    );
    // 消したあとの値でエラーを出し直す。フォームの検証は欄を「触った」にしない
    form.validateSync("change");
  }, [shouldClear, field, choices, runAsUserEdit]);
  const showUnlisted = isUnlisted && !shouldClear;
  const selectData = useMemo(
    () =>
      showUnlisted && optionValue !== null
        ? [
            ...data,
            {
              value: optionValue,
              label: unlistedLabel,
              disabled: true,
            },
          ]
        : data,
    [data, showUnlisted, optionValue, unlistedLabel],
  );
  // literal の union の検証エラーは invalid_union になる。wrapComponent は invalid_union を
  // 欄のエラーに出さず（union の部品が読む前提）、日本語の文言も空なので、ここで読んで文言にする
  const isUnion = (schema as z.ZodTypeAny).type === "union";
  const rawErrors = useStore(field.api.form.store, (state: any) =>
    isUnion
      ? (state.fieldMeta?.[field.api.name]?.errors ?? EMPTY_ERRORS)
      : EMPTY_ERRORS,
  ) as unknown[];
  const hasUnionIssue =
    isUnion &&
    (field.api.state.meta.isTouched || field.api.form.state.isSubmitted) &&
    rawErrors
      .flat()
      .some((issue) => isUnionIssue(issue) && !isPendingIssue(issue));
  const unionErrorMessage = hasUnionIssue
    ? optionValue === null
      ? msg("zod.required" /* 必ず入力してください。 */)
      : msg(
          "zodFormMantine.enum.unlisted" /* 選択肢に無い値です。選び直してください。 */,
        )
    : undefined;

  // 選択肢に無い値は、触ったかどうかに関係なく、何が悪いかが分かる文言で出す
  const errorMessage = showUnlisted
    ? Boolean(optional || nullable)
      ? msg(
          "zodFormMantine.enum.unlistedClearable" /* 選択肢に無い値です。選び直すか、消してください。 */,
        )
      : msg(
          "zodFormMantine.enum.unlisted" /* 選択肢に無い値です。選び直してください。 */,
        )
    : (error?.message ?? unionErrorMessage);

  const isBadge = uiType === "badge";
  const displayLabel = useMemo(() => {
    if (optionValue === null) return "";
    const option = selectData.find((d) => d.value === optionValue);
    // badge は選択肢の色でバッジにする（選択肢に無い値は文字のまま）
    if (isBadge && option) return renderBadge(option);
    return option?.label ?? optionValue;
  }, [selectData, optionValue, isBadge]);

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

  // 選択肢が0件（上の欄が未選択など）なら、選べないことを示す。理由は meta の emptyMessage で書ける。
  // - emptyMessage があり、必須の欄なら、その文言を欄のエラーとして出す（schema のエラーも同じ文言。
  //   ほかの欄と同じく、触るか送信するまでは出さない）
  // - それ以外（optional の欄、emptyMessage の無い欄）は、必須エラーを出さない
  // 値は unlisted に従う（既定 clear なら消える）
  if (data.length === 0) {
    return (
      <Select
        ref={ref}
        value={null}
        data={[]}
        label={label || undefined}
        placeholder={
          emptyMessage ??
          msg("zodFormMantineLite.noOptions" /* 選択肢がありません */)
        }
        error={
          emptyMessage !== undefined && !(optional || nullable)
            ? error?.message
            : undefined
        }
        required={!(optional || nullable)}
        disabled={true}
        style={inputWrapperStyle}
      />
    );
  }

  // badge は選択済みの値もバッジで出す（Select は選択済みの値の描画を差し替えられない）
  if (isBadge) {
    return (
      <WithValueAction wrapper={actionWrapper} label={label || undefined}>
        <BadgeSelect
          inputRef={ref}
          value={optionValue}
          data={selectData}
          onChange={onChange}
          onBlur={field.onBlur}
          onFocus={onFocus}
          label={label || undefined}
          error={errorMessage}
          required={!(optional || nullable)}
          disabled={readOnly || field.disabled}
          clearable={clearable}
          style={inputWrapperStyle}
        />
      </WithValueAction>
    );
  }

  return (
    <WithValueAction wrapper={actionWrapper} label={label || undefined}>
      <Select
        ref={ref}
        value={optionValue}
        data={selectData}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        searchable={true}
        error={errorMessage}
        required={!(optional || nullable)}
        disabled={readOnly || field.disabled}
        allowDeselect={clearable}
        clearable={clearable}
        style={inputWrapperStyle}
      />
    </WithValueAction>
  );
});

export { EnumComponent as component };
