import React, { useId } from "react";
import {
  ActionIcon,
  Fieldset,
  Input,
  InputWrapper,
  Select,
} from "@mantine/core";
import { IconCircleMinus } from "@tabler/icons-react";
import z from "zod";
import { getDefaultValue } from "@zodapp/zod-form-react/common";

/**
 * `uiType: "entries"`（object・record）の共通の見た目。
 * 全体を枠（Fieldset）で囲み、行は左に ⊖、中身を薄い枠に入れて並べる。いちばん下に足す選択を置く
 */

// 入れ物のエラーは、最後の行の欄のエラーと見分けられるよう、上を 8px 空ける（FieldContainer と同じ）
const errorStyles = { error: { marginTop: 8 } };

/** 全体の枠。label は legend に出す */
export const EntriesFrame = ({
  label,
  error,
  children,
}: {
  label: string | false | undefined;
  error: string | undefined;
  children: React.ReactNode;
}) => (
  <Fieldset legend={label || undefined} mt={10}>
    <InputWrapper
      required={undefined}
      error={error}
      styles={errorStyles}
      labelElement="div" // disable auto biding of label to input
    >
      {children}
    </InputWrapper>
  </Fieldset>
);

const removeButtonStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  backgroundColor: "white",
  zIndex: 2,
  outline: "none",
};

/**
 * 1 行。onRemove があれば左に ⊖ を出す（readOnly では出さない）。
 * label を渡すと、行の上に項目の名前を出し、行を role="group" にしてその名前を付ける
 * （中の欄には label を渡さないので、欄の必須の印が行の上に付かない）
 */
export const EntryRow = ({
  label,
  readOnly,
  onRemove,
  removeLabel,
  children,
}: {
  label?: string;
  readOnly: boolean | undefined;
  onRemove?: () => void;
  removeLabel?: string;
  children: React.ReactNode;
}) => {
  const labelId = useId();
  return (
    <div
      role={label !== undefined ? "group" : undefined}
      aria-labelledby={label !== undefined ? labelId : undefined}
      style={{
        position: "relative",
        paddingLeft: readOnly ? 15 : 37,
        marginTop: 5,
        marginBottom: 5,
      }}
    >
      <div
        style={{
          border: "1px solid var(--mantine-color-gray-3)",
          borderRadius: 4,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {label !== undefined && (
          <Input.Label component="div" id={labelId} mt={5}>
            {label}
          </Input.Label>
        )}
        {children}
      </div>
      {!readOnly && onRemove && (
        <ActionIcon
          aria-label={removeLabel}
          size={20}
          variant="light"
          color="#63687C"
          style={removeButtonStyle}
          onClick={onRemove}
        >
          <IconCircleMinus />
        </ActionIcon>
      )}
    </div>
  );
};

/** まだ値に無い項目（キー）を選んで足す選択。足せるものが無ければ出さない */
export const EntryAddSelect = ({
  options,
  onAdd,
  placeholder,
}: {
  options: { value: string; label: string }[];
  onAdd: (key: string) => void;
  placeholder: string;
}) =>
  options.length === 0 ? null : (
    <Select
      aria-label={placeholder}
      placeholder={placeholder}
      data={options}
      value={null}
      onChange={(key) => {
        if (key) onAdd(key);
      }}
      searchable
      clearable={false}
      nothingFoundMessage="-"
      style={{ marginTop: 10, paddingLeft: 37 }}
    />
  );

/** キーが無くても通る項目（`.optional()`・`.default()` など）。行の有る・無いを親が扱う */
export const isOptionalProperty = (schema: z.ZodTypeAny): boolean =>
  schema._zod.optin === "optional";

/**
 * 足した行の値。外側の optional の包みを外した schema の既定値
 * （optional のままだと undefined になるため。object なら `{}`、`.default(x)` なら x）
 */
export const addedEntryValue = (schema: z.ZodTypeAny): unknown => {
  let current = schema;
  while (current.def.type === "optional")
    current = (current.def as unknown as { innerType: z.ZodTypeAny }).innerType;
  try {
    return getDefaultValue(current);
  } catch {
    return undefined;
  }
};
