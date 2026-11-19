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
  /** 値に入っているキー。まだ値に入れていない行・キーが書きかけの行は "" */
  key: string;
  /**
   * キーを不正な書きかけにしたときに、値から外した組の値と、元の位置。
   * キーを直したら、この値で組を元の位置に戻す（書きかけのあいだは、その組を送らない）
   */
  held?: { value: unknown; index: number };
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
      // 今の行の並びを保ち、値から消えたキーの行を外し、新しいキーの行を後ろに足す
      // （キーを入れる前の行・キーが書きかけの行は残す）
      setRows((currentRows) => {
        const keySet = new Set(valueKeys);
        const kept = currentRows.filter(
          (row) => row.key === "" || keySet.has(row.key),
        );
        const known = new Set(kept.map((row) => row.key));
        return [
          ...kept,
          ...valueKeys.filter((key) => !known.has(key)).map(createEntryRow),
        ];
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
            "zodFormMantine.record.duplicateKey" /* i18n: 同じキーが既に存在します */,
          )
        : !parsedKey.success
          ? msg.resolve(parsedKey.error.issues[0]?.message)
          : draftKey === ""
            ? msg(
                "zodFormMantine.record.emptyKey" /* i18n: キーを入力してください */,
              )
            : isUnsafeFieldKey(draftKey)
              ? msg(
                  "zodFormMantine.record.unsafeKey" /* i18n: キーに . [ ] は使えません */,
                )
              : undefined;

      if (keyError) {
        // 値に入っている組のキーを不正な書きかけにしたら、その組を値から外し、値と位置を行に持っておく
        // （画面と違う古いキーのまま送らない。書きかけのあいだは、その組が無いまま送る）
        let held = row.held;
        if (row.key) {
          const entries = Object.entries(value);
          const index = entries.findIndex(([key]) => key === row.key);
          held = { value: value[row.key], index };
          field.onChange(
            Object.fromEntries(entries.filter((_, i) => i !== index)),
          );
        }
        setRows((currentRows) =>
          currentRows.map((item) =>
            item.id === row.id
              ? { ...item, key: "", held, draftKey, keyError }
              : item,
          ),
        );
        return;
      }

      // キーの順を保ったまま、キーだけを差し替える。書きかけで外した組は、持っておいた値で元の位置に戻す
      const entries = Object.entries(value);
      const nextValue = row.key
        ? Object.fromEntries(
            entries.map(([key, itemValue]) =>
              key === row.key ? [draftKey, itemValue] : [key, itemValue],
            ),
          )
        : row.held
          ? Object.fromEntries([
              ...entries.slice(0, row.held.index),
              [draftKey, row.held.value],
              ...entries.slice(row.held.index),
            ])
          : { ...value, [draftKey]: getValueDefault(valueSchema) };
      field.onChange(nextValue);
      setRows((currentRows) =>
        currentRows.map((item) =>
          item.id === row.id
            ? {
                ...item,
                key: draftKey,
                held: undefined,
                draftKey,
                keyError: undefined,
              }
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
                label={msg("zodFormMantine.record.key" /* i18n: キー */)}
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
                    label={msg("zodFormMantine.record.value" /* i18n: 値 */)}
                  />
                ) : (
                  <TextInput
                    label={msg("zodFormMantine.record.value" /* i18n: 値 */)}
                    placeholder={
                      row.held
                        ? msg(
                            "zodFormMantine.record.keyHeld" /* i18n: キーを直すと、値が戻ります */,
                          )
                        : msg(
                            "zodFormMantine.record.keyFirst" /* i18n: 先にキーを入力してください */,
                          )
                    }
                    disabled
                  />
                )}
              </div>
            </Group>
          </div>
          {!readOnly && (
            <ActionIcon
              aria-label={msg(
                "zodFormMantine.record.removeRow" /* i18n: ${label}を削除 */,
                {
                  label:
                    row.draftKey ||
                    row.key ||
                    msg("zodFormMantine.record.emptyRow" /* i18n: 空の行 */),
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
                  "zodFormMantine.record.append" /* i18n: 末尾に追加 */,
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
