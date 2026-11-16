import React, { useMemo } from "react";
import { ActionIcon, Group, InputWrapper, Loader, Select } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  useExternalKeyAction,
  useExternalKeyOptions,
} from "@zodapp/zod-form-react/utils/externalKey";
import { ReadonlyText } from "../utils/text";
import type z from "zod";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";
import { FetchErrorView } from "../utils/fetchErrorView";
import { externalKeyDisplayLabel, withUnlistedOption } from "../utils/unlisted";

type ExternalKeySchema = z.ZodString;

const ExternalKeyComponent = React.memo(function ExternalKeyComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  optional,
  readOnly: readOnlyProp,
}: ZodFormProps<ExternalKeySchema>) {
  const meta = getMeta(schema, "externalKey");
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? meta?.label;
  const allowUnlisted = meta?.allowUnlisted === true;

  const { options, isLoading, retry } = useExternalKeyOptions(schema);

  const rawValue = (defaultValue as string | undefined) ?? null;
  const { value, onChange, hasPendingChange, onConfirm, onBlur, onCancel } =
    useConfirmableState(rawValue, fieldPath);
  const actionWrapper = useExternalKeyAction(schema, value);

  // 選択肢に無い値は、zod-form-mantine の欄や表のセルと同じく「（不正な値）」と出す（生の値は見せない）。
  // allowUnlisted なら正しい値なので、値そのものを出す。選択肢が無い（取得に失敗した）ときも、生の値は見せない
  const displayLabel = useMemo(() => {
    if (isLoading) return "Loading...";
    if (!value) return "";
    return externalKeyDisplayLabel(options ?? [], value, allowUnlisted);
  }, [isLoading, options, value, allowUnlisted]);

  // 編集できる欄では、選択肢に無い値を選べない選択肢として足す（足さないと Select は空欄に見せる）
  const selectData = useMemo(
    () => withUnlistedOption(options ?? [], value || null, displayLabel),
    [options, value, displayLabel],
  );

  const actionContent = actionWrapper
    ? actionWrapper(
        <ActionIcon
          component="span"
          size="md"
          variant="subtle"
          aria-label={`${label ?? "選択済み項目"}を開く`}
          style={{
            color: "var(--mantine-primary-color-filled)",
          }}
        >
          <IconExternalLink size={16} />
        </ActionIcon>,
      )
    : null;

  // 取得に失敗したら、再試行のボタンを出す（読み取り専用でも、選択肢が無いと表示名が出せないため）
  if (retry) {
    return <FetchErrorView label={label || undefined} retry={retry} />;
  }

  if (readOnly) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <Group gap="0" wrap="nowrap" align="center">
          <ReadonlyText style={{ flex: 1 }}>{displayLabel}</ReadonlyText>
          {actionContent}
        </Group>
      </InputWrapper>
    );
  }

  if (isLoading) {
    return (
      <Select
        value={null}
        data={[]}
        onChange={() => {}}
        label={label || undefined}
        required={!optional}
        disabled
        rightSection={<Loader size="xs" />}
        placeholder="Loading..."
        style={inputWrapperStyle}
      />
    );
  }

  if (options.length === 0) {
    return (
      <Select
        value={null}
        data={[]}
        onChange={() => {}}
        label={label || undefined}
        required={!optional}
        disabled
        placeholder="選択肢がありません"
        style={inputWrapperStyle}
      />
    );
  }

  const select = (
    <Select
      value={value}
      data={selectData}
      onChange={(next) => onChange(next)}
      onBlur={() => void onBlur()}
      label={label || undefined}
      searchable
      required={!optional}
      allowDeselect
      clearable
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: value ? 24 : 0,
      })}
    />
  );

  if (!actionContent) {
    return select;
  }

  return (
    <Group gap="0" wrap="nowrap" align="flex-end">
      <div style={{ flex: 1 }}>{select}</div>
      {actionContent}
    </Group>
  );
});

ExternalKeyComponent.displayName = "ReactiveExternalKeyComponent";

export { ExternalKeyComponent as component };
