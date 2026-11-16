import React, { useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import { useEmptiness, type ZodFormProps } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "../utils/text";
import { renderBadge } from "../utils/selectOption";
import { BadgeSelect } from "../utils/badgeSelect";
import {
  useEnumData,
  toEnumOptionValue,
  fromEnumOptionValue,
} from "../utils/enum";
import {
  useConfirmableState,
  confirmableRightSectionProps,
  ConfirmableInputActions,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";
import { UNLISTED_LABEL, withUnlistedOption } from "../utils/unlisted";

type EnumSchema = ReturnType<typeof zf.enum>;

/** 確定・取消ボタン 2 つ分の幅（confirmableRightSectionProps の BASE_WIDTH と同じ） */
const CONFIRM_ACTIONS_WIDTH = 64;

const EnumComponent = React.memo(function EnumComponent({
  schema,
  fieldPath,
  samePath,
  defaultValue,
  label: labelFromParent,
  readOnly: readOnlyProp,
}: ZodFormProps<EnumSchema>) {
  const { optional, nullable } = useEmptiness(fieldPath, samePath);
  const meta = getMeta(schema);
  const labelFromMeta = meta?.label;
  const uiType = meta?.uiType;
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = (defaultValue as string | number | undefined) ?? null;
  const { value, onChange, hasPendingChange, onConfirm, onBlur, onCancel } =
    useConfirmableState(rawValue, fieldPath);

  const data = useEnumData(schema);

  // 数値の選択肢も扱えるよう、Select とは文字列でやりとりする (0 も値として残す)
  const optionValue = toEnumOptionValue(value);

  // 選択肢に無い値は、zod-form-mantine の欄や表のセルと同じく「（不正な値）」と出す（生の値は見せない）。
  // 編集できる欄では、選べない選択肢として足す（足さないと Select は空欄に見せる）
  const selectData = useMemo(
    () => withUnlistedOption(data, optionValue, UNLISTED_LABEL),
    [data, optionValue],
  );

  const isBadge = uiType === "badge";
  const displayLabel = useMemo(() => {
    if (optionValue === null) return "";
    const option = data.find((d) => d.value === optionValue);
    if (!option) return UNLISTED_LABEL;
    // badge は選択肢の色でバッジにする（選択肢に無い値は「（不正な値）」の文字のまま）
    return isBadge ? renderBadge(option) : option.label;
  }, [data, optionValue, isBadge]);

  if (readOnly) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{displayLabel}</ReadonlyText>
      </InputWrapper>
    );
  }

  // badge は選択済みの値もバッジで出す（Select は選択済みの値の描画を差し替えられない）
  if (isBadge) {
    return (
      <BadgeSelect
        value={optionValue}
        data={selectData}
        onChange={(next) => onChange(fromEnumOptionValue(schema, next) ?? null)}
        onBlur={() => void onBlur()}
        label={label || undefined}
        required={!(optional || nullable)}
        style={inputWrapperStyle}
        actions={
          hasPendingChange ? (
            <ConfirmableInputActions
              onConfirm={() => void onConfirm()}
              onCancel={onCancel}
            />
          ) : undefined
        }
        actionsWidth={hasPendingChange ? CONFIRM_ACTIONS_WIDTH : 0}
      />
    );
  }

  return (
    <Select
      value={optionValue}
      data={selectData}
      onChange={(next) => onChange(fromEnumOptionValue(schema, next) ?? null)}
      onBlur={() => void onBlur()}
      label={label || undefined}
      searchable
      required={!(optional || nullable)}
      allowDeselect
      clearable
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: optionValue !== null ? 24 : 0,
      })}
    />
  );
});

EnumComponent.displayName = "ReactiveEnumComponent";

export { EnumComponent as component };
