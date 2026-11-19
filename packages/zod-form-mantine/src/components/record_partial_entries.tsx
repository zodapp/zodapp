import { useMsg } from "../messages/useMsg";
import { useResolvedMeta, useResolveText } from "@zodapp/zod-form-react/common";
import React from "react";
import { ActionIcon, InputWrapper, Select } from "@mantine/core";
import { IconCircleMinus } from "@tabler/icons-react";
import z from "zod";
import {
  Switch,
  ContainerMarker,
  ZodFormInternalProps,
  getDefaultValue,
  wrapComponent,
  isUnsafeFieldKey,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { partialRecordKeys } from "@zodapp/zod-form";
import { ownsContainerMarker } from "./container";
import { keyLabelsOf } from "./record";
import { UnsafeRecordEntry } from "../utils/unsafeKey";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

const joinFieldPath = (fieldPath: string, key: string) =>
  fieldPath + (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") + key;

const getValueDefault = (schema: z.ZodTypeAny): unknown => {
  try {
    return getDefaultValue(schema);
  } catch {
    return undefined;
  }
};

/**
 * 行の並び。keyOrder が definition（既定）なら候補の定義順、value なら値の object の順。
 * 候補に無いキー（保存されていた値など）は、どちらでも後ろに並べる
 */
export const orderPartialRecordKeys = (
  valueKeys: string[],
  candidates: string[],
  keyOrder: "definition" | "value" | undefined,
): string[] => {
  const candidateSet = new Set(candidates);
  const known = valueKeys.filter((key) => candidateSet.has(key));
  const unknown = valueKeys.filter((key) => !candidateSet.has(key));
  if (keyOrder === "value") return [...known, ...unknown];
  const valueSet = new Set(valueKeys);
  return [...candidates.filter((key) => valueSet.has(key)), ...unknown];
};

/**
 * キーが enum・literal の `z.partialRecord` を `uiType: "entries"` で描く部品。
 * 値にあるキーだけを、キーの label を名前にした行で並べる（キーは書き換えられず、行は削除だけできる）。
 * いちばん下の選択で、まだ値に無いキーを足す（足した行の値は値の schema の既定値）。
 * 行の並びは meta の keyOrder で決める
 */
export const PartialRecordEntriesComponent = wrapComponent(
  function PartialRecordEntriesComponentImplement({
    fieldPath,
    schema,
    defaultValue,
    readOnly,
    label: labelFromParent,
    error,
    field,
    hideError,
    errorToken,
  }: ZodFormInternalProps<RecordSchema>) {
    const meta = useResolvedMeta(schema) as
      | { label?: string; keyOrder?: "definition" | "value" }
      | undefined;
    const msg = useMsg();
    const resolveText = useResolveText();
    const valueSchema = schema.def.valueType;
    const candidates = partialRecordKeys(schema) ?? [];
    const labels = keyLabelsOf(schema);
    const keyLabel = (key: string) => resolveText(labels.get(key)) ?? key;
    const value = (field.value ?? defaultValue ?? {}) as Record<
      string,
      unknown
    >;
    const valueKeys = Object.keys(value);
    const keys = orderPartialRecordKeys(valueKeys, candidates, meta?.keyOrder);
    const usedKeys = new Set(valueKeys);
    const unusedKeys = candidates.filter((key) => !usedKeys.has(key));
    const label = labelFromParent ?? meta?.label;

    const handleAdd = (key: string | null) => {
      if (!key || usedKeys.has(key)) return;
      // 足したキーは値の object の末尾に入れる（keyOrder: value のとき、足した順に並ぶ）
      field.onChange({ ...value, [key]: getValueDefault(valueSchema) });
    };

    const handleRemove = (key: string) => {
      const nextValue = { ...value };
      delete nextValue[key];
      field.onChange(nextValue);
    };

    const rowComponents = keys.map((key) =>
      isUnsafeFieldKey(key) ? (
        <UnsafeRecordEntry
          key={key}
          recordPath={fieldPath}
          entryKey={key}
          readOnly={readOnly}
          onRemove={() => handleRemove(key)}
        />
      ) : (
        <div
          key={key}
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
            <Switch
              fieldPath={joinFieldPath(fieldPath, key)}
              schema={valueSchema}
              defaultValue={value[key]}
              outer={undefined}
              readOnly={readOnly}
              label={keyLabel(key)}
            />
          </div>
          {!readOnly && (
            <ActionIcon
              aria-label={msg(
                "zodFormMantine.record.removeRow" /* i18n: ${label}を削除 */,
                { label: keyLabel(key) },
              )}
              size={20}
              variant="light"
              color="#63687C"
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                backgroundColor: "white",
                zIndex: 2,
                outline: "none",
              }}
              onClick={() => handleRemove(key)}
            >
              <IconCircleMinus />
            </ActionIcon>
          )}
        </div>
      ),
    );

    return (
      <InputWrapper
        label={label || undefined}
        required={false}
        error={error?.message}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <div style={{ marginTop: 5, minHeight: 20, marginBottom: 15 }}>
          {rowComponents}
          {ownsContainerMarker({ hideError, errorToken }) && (
            <ContainerMarker fieldPath={fieldPath} />
          )}
          {!readOnly && unusedKeys.length > 0 && (
            <Select
              aria-label={msg(
                "zodFormMantine.record.addKey" /* i18n: キーを追加 */,
              )}
              placeholder={msg(
                "zodFormMantine.record.addKey" /* i18n: キーを追加 */,
              )}
              data={unusedKeys.map((key) => ({
                value: key,
                label: keyLabel(key),
              }))}
              value={null}
              onChange={handleAdd}
              searchable
              clearable={false}
              nothingFoundMessage="-"
              style={{ marginTop: 10, paddingLeft: 37 }}
            />
          )}
        </div>
      </InputWrapper>
    );
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    invalid: false,
  },
);

PartialRecordEntriesComponent.displayName = "PartialRecordEntriesComponent";
