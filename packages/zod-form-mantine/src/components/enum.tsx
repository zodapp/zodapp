import React, { useCallback, useEffect, useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useSchemaValueAction,
  useRunAsUserEdit,
  useEmptiness,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  BadgeSelect,
  renderBadge,
  useEnumData,
  toEnumOptionValue,
  fromEnumOptionValue,
  ReadonlyText,
  WithValueAction,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = wrapComponent(function EnumComponentImplement({
  fieldPath,
  samePath,
  schema,
  label: labelFromParent,
  readOnly,
  field,
  error,
}: ZodFormInternalProps<EnumSchema>) {
  const { optional, nullable, emptyValue } = useEmptiness(fieldPath, samePath);
  const {
    label: labelFromMeta,
    uiType,
    unlisted,
    emptyMessage,
  } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const onChange = useCallback(
    (value: string | null | undefined) => {
      field.onChange(fromEnumOptionValue(schema, value) ?? emptyValue);
    },
    [field, schema, emptyValue],
  );

  const data = useEnumData(schema);
  // 数値の選択肢も扱えるよう、Select とは文字列でやりとりする (0 も値として残す)
  const optionValue = toEnumOptionValue(field.value);
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
        fromEnumOptionValue(schema, null) as never,
        // 欄の検証（validateField）は欄を「触った」にするので使わない
        { dontUpdateMeta: true, dontValidate: true },
      ),
    );
    // 消したあとの値でエラーを出し直す。フォームの検証は欄を「触った」にしない
    form.validateSync("change");
  }, [shouldClear, field, schema, runAsUserEdit]);
  const showUnlisted = isUnlisted && !shouldClear;
  const selectData = useMemo(
    () =>
      showUnlisted && optionValue !== null
        ? [
            ...data,
            {
              value: optionValue,
              label: "（不正な値）",
              disabled: true,
            },
          ]
        : data,
    [data, showUnlisted, optionValue],
  );
  // 選択肢に無い値は、触ったかどうかに関係なく、何が悪いかが分かる文言で出す
  const errorMessage = showUnlisted
    ? Boolean(optional || nullable)
      ? "選択肢に無い値です。選び直すか、消してください。"
      : "選択肢に無い値です。選び直してください。"
    : error?.message;

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
        placeholder={emptyMessage ?? "選択肢がありません"}
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
        allowDeselect={true}
        clearable={true}
        style={inputWrapperStyle}
      />
    </WithValueAction>
  );
});

export { EnumComponent as component };
