import { zodMsgKeyErrorMap } from "@zodapp/i18n-messages-zod";
import { useMsg } from "../messages/useMsg";
import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useEffect, useState } from "react";
import { ActionIcon, Group, InputWrapper, TextInput } from "@mantine/core";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import z from "zod";
import {
  Switch,
  ContainerMarker,
  ZodFormInternalProps,
  type ZodFormProps,
  getDefaultValue,
  wrapComponent,
  emptinessOf,
  isUnsafeFieldKey,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { ownsContainerMarker } from "./container";
import { FixedKeysRecordComponent } from "./record";
import { enumeratedRecordKeys } from "@zodapp/zod-form";
import { UnsafeRecordEntry } from "../utils/unsafeKey";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

type EntryRow = {
  id: number;
  key: string;
  draftKey: string;
  keyError?: string;
};

let entryId = 0;
const createEntryRow = (key: string): EntryRow => ({
  id: ++entryId,
  key,
  draftKey: key,
});

const joinFieldPath = (fieldPath: string, key: string) =>
  fieldPath + (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") + key;

const getRecordValue = (
  fieldValue: Record<string, unknown> | undefined,
  defaultValue: Record<string, unknown> | undefined,
) => fieldValue ?? defaultValue ?? {};

const getValueDefault = (schema: z.ZodTypeAny): unknown => {
  try {
    return getDefaultValue(schema);
  } catch {
    return undefined;
  }
};

const RecordEntriesComponent = wrapComponent(
  function RecordEntriesComponentImplement({
    fieldPath,
    schema,
    defaultValue,
    outer,
    readOnly,
    label: labelFromParent,
    error,
    field,
    hideError,
    errorToken,
  }: ZodFormInternalProps<RecordSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const meta = useResolvedMeta(schema);
    const msg = useMsg();
    const valueSchema = schema.def.valueType;
    const keySchema = schema.def.keyType;
    const value = getRecordValue(field.value, defaultValue);
    const valueKeys = Object.keys(value);
    const valueKeysSignature = valueKeys.join("\u0000");
    const label = labelFromParent ?? meta?.label;
    const [rows, setRows] = useState<EntryRow[]>(() =>
      valueKeys.map(createEntryRow),
    );

    useEffect(() => {
      // Record values can also be replaced by form reset or external state updates.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows((currentRows) => {
        const currentByKey = new Map(currentRows.map((row) => [row.key, row]));
        return valueKeys.map(
          (key) => currentByKey.get(key) ?? createEntryRow(key),
        );
      });
      // valueKeysSignature intentionally tracks key additions, removals, and ordering
      // without resetting draft key text when only a record value changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valueKeysSignature]);

    const usedKeys = new Set(valueKeys);
    // キーの検査のエラー（invalid_key）は、record の欄ではなく、そのキーの欄に出す
    // （zod-form-react が path を record にし、どのキーかを key に入れている）
    const invalidKeyError = error as
      | { code?: string; key?: string; message?: string }
      | undefined;
    const invalidKey =
      invalidKeyError?.code === "invalid_key" &&
      rows.some((row) => row.key === invalidKeyError.key)
        ? invalidKeyError.key
        : undefined;

    const handleAdd = () => {
      setRows((currentRows) => [...currentRows, createEntryRow("")]);
    };

    const handleRemove = (row: EntryRow) => {
      const nextValue = { ...value };
      if (row.key) {
        delete nextValue[row.key];
        field.onChange(nextValue);
      }
      setRows((currentRows) =>
        currentRows.filter((item) => item.id !== row.id),
      );
    };

    const handleKeyChange = (row: EntryRow, draftKey: string) => {
      const parsedKey = keySchema.safeParse(draftKey, {
        error: zodMsgKeyErrorMap,
      });
      const duplicate = draftKey !== row.key && usedKeys.has(draftKey);
      // キーの schema の文言を先に出す。通っても、フィールドパスに使えないキーは値に入れない（重複と同じ扱い）
      const keyError = duplicate
        ? msg(
            "zodFormMantine.record.duplicateKey" /* 同じキーが既に存在します */,
          )
        : !parsedKey.success
          ? msg.resolve(parsedKey.error.issues[0]?.message)
          : draftKey === ""
            ? msg("zodFormMantine.record.emptyKey" /* キーを入力してください */)
            : isUnsafeFieldKey(draftKey)
              ? msg(
                  "zodFormMantine.record.unsafeKey" /* キーに . [ ] は使えません */,
                )
              : undefined;

      if (keyError) {
        setRows((currentRows) =>
          currentRows.map((item) =>
            item.id === row.id ? { ...item, draftKey, keyError } : item,
          ),
        );
        return;
      }

      const nextValue = row.key
        ? Object.fromEntries(
            Object.entries(value).map(([key, itemValue]) =>
              key === row.key ? [draftKey, itemValue] : [key, itemValue],
            ),
          )
        : { ...value, [draftKey]: getValueDefault(valueSchema) };
      field.onChange(nextValue);
      setRows((currentRows) =>
        currentRows.map((item) =>
          item.id === row.id
            ? { ...item, key: draftKey, draftKey, keyError: undefined }
            : item,
        ),
      );
    };

    const rowComponents = rows.map((row) =>
      // 保存されていた値の、フィールドパスに使えないキー。編集せず、消すだけにする
      row.key !== "" && isUnsafeFieldKey(row.key) ? (
        <UnsafeRecordEntry
          key={`item-${row.id}`}
          recordPath={fieldPath}
          entryKey={row.key}
          readOnly={readOnly}
          onRemove={() => handleRemove(row)}
        />
      ) : (
        <div
          key={`item-${row.id}`}
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
            <Group align="flex-start" wrap="nowrap">
              <TextInput
                label={msg("zodFormMantine.record.key" /* キー */)}
                value={row.draftKey}
                error={
                  row.keyError ??
                  (invalidKey !== undefined && row.key === invalidKey
                    ? error?.message
                    : undefined)
                }
                readOnly={readOnly}
                onChange={(event) =>
                  handleKeyChange(row, event.currentTarget.value)
                }
                onBlur={() => {
                  handleKeyChange(row, row.draftKey);
                  field.onBlur();
                }}
                style={{ flex: 1 }}
              />
              <div style={{ flex: 1 }}>
                {row.key ? (
                  <Switch
                    fieldPath={joinFieldPath(fieldPath, row.key)}
                    schema={valueSchema}
                    defaultValue={value[row.key]}
                    outer={undefined}
                    readOnly={readOnly}
                    label={msg("zodFormMantine.record.value" /* 値 */)}
                  />
                ) : (
                  <TextInput
                    label={msg("zodFormMantine.record.value" /* 値 */)}
                    placeholder={msg(
                      "zodFormMantine.record.keyFirst" /* 先にキーを入力してください */,
                    )}
                    disabled
                  />
                )}
              </div>
            </Group>
          </div>
          {!readOnly && (
            <ActionIcon
              aria-label={msg(
                "zodFormMantine.record.removeRow" /* ${label}を削除 */,
                {
                  label:
                    row.draftKey ||
                    row.key ||
                    msg("zodFormMantine.record.emptyRow" /* 空の行 */),
                },
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
              onClick={() => handleRemove(row)}
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
        required={!(optional || nullable)}
        error={invalidKey !== undefined ? undefined : error?.message}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <div
          style={{
            marginTop: readOnly ? 0 : 15,
            minHeight: 20,
            marginBottom: 15,
          }}
        >
          {rowComponents}
          {ownsContainerMarker({ hideError, errorToken }) && (
            <ContainerMarker fieldPath={fieldPath} />
          )}
          {!readOnly && (
            <div style={{ position: "relative" }}>
              <ActionIcon
                aria-label={msg(
                  "zodFormMantine.record.append" /* 末尾に追加 */,
                )}
                size={20}
                variant="light"
                color="#63687C"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "calc(50% - 3px)",
                  transform: "translateY(-50%)",
                  backgroundColor: "white",
                  zIndex: 1,
                  outline: "none",
                }}
                onClick={handleAdd}
              >
                <IconCirclePlus />
              </ActionIcon>
            </div>
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

RecordEntriesComponent.displayName = "RecordEntriesComponent";

/** キーを列挙できる record は、entries の見た目でも固定のキーで描く（キーの追加・名前の変更はできないため） */
const RecordEntriesSwitch = (props: ZodFormProps<RecordSchema>) =>
  enumeratedRecordKeys(props.schema) ? (
    <FixedKeysRecordComponent {...props} />
  ) : (
    <RecordEntriesComponent {...props} />
  );

export { RecordEntriesSwitch as component };
