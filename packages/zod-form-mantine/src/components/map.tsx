import React, { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Checkbox,
  Group,
  InputWrapper,
  NumberInput,
  Select,
  TextInput,
} from "@mantine/core";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import type z from "zod";
import { zodMsgKeyErrorMap } from "@zodapp/i18n-messages-zod";
import {
  ZodFormInternalProps,
  type ZodFormProps,
  wrapComponent,
  emptinessOf,
  useResolvedMeta,
} from "@zodapp/zod-form-react/common";
import {
  inputWrapperStyle,
  useChoices,
} from "@zodapp/zod-form-mantine-lite/utils";
import { useMsg } from "../messages/useMsg";
import { UnsupportedNotice } from "../utils/unsupported";

type MapSchema = z.ZodMap<z.ZodTypeAny, z.ZodTypeAny>;
type MapKey = string | number;

/** キーに使える型（文字か数） */
const KEY_TYPES = new Set(["string", "number"]);
/** 値に使える型（その場で描ける入力） */
const VALUE_TYPES = new Set(["string", "number", "boolean", "enum"]);

type EntryRow = {
  id: number;
  /** 値に入っているキー。まだ値に入れていない行・キーが書きかけの行は undefined */
  key: MapKey | undefined;
  /**
   * キーを不正な書きかけにしたときに、値から外した組の値と、元の位置。
   * キーを直したら、この値で組を元の位置に戻す（書きかけのあいだは、その組を送らない）
   */
  held?: { value: unknown; index: number };
  draftKey: string;
  keyError?: string;
};

let entryId = 0;
const createEntryRow = (key: MapKey | undefined): EntryRow => ({
  id: ++entryId,
  key,
  draftKey: key === undefined ? "" : String(key),
});

const toMap = (value: unknown): Map<MapKey, unknown> =>
  value instanceof Map ? (value as Map<MapKey, unknown>) : new Map();

type ValueInputProps = {
  schema: z.ZodTypeAny;
  value: unknown;
  error: string | undefined;
  readOnly: boolean | undefined;
  label: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
};

/** enum の値の入力（選択肢は enum の部品と同じ規則で作る） */
const EnumValueInput = ({
  schema,
  value,
  error,
  readOnly,
  label,
  onChange,
  onBlur,
}: ValueInputProps) => {
  const choices = useChoices(schema);
  return (
    <Select
      label={label}
      data={choices.data}
      value={choices.toOption(value)}
      error={error}
      readOnly={readOnly}
      onChange={(option) => onChange(choices.fromOption(option))}
      onBlur={onBlur}
    />
  );
};

/** 値の入力（値の schema の型ごと）。フォームの path には割り当てず、Map 全体を書き換える */
const MapValueInput = (props: ValueInputProps) => {
  const { schema, value, error, readOnly, label, onChange, onBlur } = props;
  switch (schema.type) {
    case "number":
      return (
        <NumberInput
          label={label}
          value={typeof value === "number" ? value : ""}
          error={error}
          readOnly={readOnly}
          onChange={(next) =>
            onChange(typeof next === "number" ? next : undefined)
          }
          onBlur={onBlur}
        />
      );
    case "boolean":
      return (
        <Checkbox
          label={label}
          checked={value === true}
          error={error}
          readOnly={readOnly}
          onChange={(event) => onChange(event.currentTarget.checked)}
          onBlur={onBlur}
          mt="lg"
        />
      );
    case "enum":
      return <EnumValueInput {...props} />;
    default:
      return (
        <TextInput
          label={label}
          value={typeof value === "string" ? value : ""}
          error={error}
          readOnly={readOnly}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onBlur}
        />
      );
  }
};

/**
 * Map（`z.map`）。record の entries と同じ見た目で、キーと値の組を足し・消し・書き換える。
 *
 * 値には TanStack Form のパスで欄を割り当てられないので、set と同じく欄を 1 つにし、Map 全体を書き換える。
 * キー・値のエラーは、Map を zod で検証してこの欄の中に出す（キーの行・値の行に分ける）。
 * キーは string・number、値は string・number・boolean・enum だけを受ける（それ以外は呼び出し元で注記を出す）
 */
const MapEntriesComponent = wrapComponent(
  function MapEntriesComponentImplement({
    schema,
    outer,
    readOnly,
    label: labelFromParent,
    error,
    field,
  }: ZodFormInternalProps<MapSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const meta = useResolvedMeta(schema);
    const msg = useMsg();
    const keySchema = schema.def.keyType as z.ZodTypeAny;
    const valueSchema = schema.def.valueType as z.ZodTypeAny;
    const isNumberKey = keySchema.type === "number";
    const value = toMap(field.value);
    const keys = Array.from(value.keys());
    const keysSignature = keys.map(String).join("\u0000");
    const label = labelFromParent ?? meta?.label;
    const [rows, setRows] = useState<EntryRow[]>(() =>
      keys.map(createEntryRow),
    );

    useEffect(() => {
      // reset や外からの書き換えで、Map のキーが変わったときに行をそろえる（書きかけのキーは残す）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows((currentRows) => {
        // 今の行の並びを保ち、値から消えたキーの行を外し、新しいキーの行を後ろに足す
        const keySet = new Set<unknown>(keys);
        const kept = currentRows.filter(
          (row) => row.key === undefined || keySet.has(row.key),
        );
        const known = new Set<unknown>(kept.map((row) => row.key));
        return [
          ...kept,
          ...keys.filter((key) => !known.has(key)).map(createEntryRow),
        ];
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keysSignature]);

    // キーと値を、それぞれの schema で検証して行ごとに出す（zod は Map のキーのエラーも値のエラーも、
    // path をキーにして返すので、Map 全体の検証からは見分けられない）。Map そのものの検査（.min() など）は欄に出す
    const showErrors =
      field.api.state.meta.isTouched ||
      field.api.form.state.submissionAttempts > 0;
    const { rowErrors, mapError } = useMemo(() => {
      const byKey = new Map<unknown, { key?: string; value?: string }>();
      if (!(field.value instanceof Map))
        return { rowErrors: byKey, mapError: undefined };
      const firstMessage = (target: z.ZodTypeAny, input: unknown) => {
        const result = target.safeParse(input, { error: zodMsgKeyErrorMap });
        return result.success
          ? undefined
          : msg.resolve(result.error.issues[0]?.message);
      };
      for (const [key, itemValue] of field.value as Map<unknown, unknown>) {
        const keyMessage = firstMessage(keySchema, key);
        const valueMessage = firstMessage(valueSchema, itemValue);
        if (keyMessage || valueMessage)
          byKey.set(key, { key: keyMessage, value: valueMessage });
      }
      const whole = schema.safeParse(field.value, { error: zodMsgKeyErrorMap });
      const rootIssue = whole.success
        ? undefined
        : whole.error.issues.find((issue) => issue.path.length === 0);
      return {
        rowErrors: byKey,
        mapError: rootIssue ? msg.resolve(rootIssue.message) : undefined,
      };
    }, [field.value, schema, keySchema, valueSchema, msg]);

    const write = (next: Map<MapKey, unknown>) => field.onChange(next);

    const handleRemove = (row: EntryRow) => {
      if (row.key !== undefined) {
        const next = new Map(value);
        next.delete(row.key);
        write(next);
      }
      setRows((currentRows) =>
        currentRows.filter((item) => item.id !== row.id),
      );
    };

    const handleKeyChange = (row: EntryRow, draftKey: string) => {
      const key: MapKey = isNumberKey ? Number(draftKey) : draftKey;
      const parsed = keySchema.safeParse(key, { error: zodMsgKeyErrorMap });
      const duplicate =
        draftKey !== "" && !Object.is(key, row.key) && value.has(key);
      const keyError =
        draftKey === ""
          ? msg(
              "zodFormMantine.record.emptyKey" /* i18n: キーを入力してください */,
            )
          : duplicate
            ? msg(
                "zodFormMantine.record.duplicateKey" /* i18n: 同じキーが既に存在します */,
              )
            : (isNumberKey && Number.isNaN(key)) || !parsed.success
              ? msg.resolve(
                  parsed.success ? undefined : parsed.error.issues[0]?.message,
                )
              : undefined;
      if (keyError) {
        // 値に入っている組のキーを不正な書きかけにしたら、その組を値から外し、値と位置を行に持っておく
        // （画面と違う古いキーのまま送らない。書きかけのあいだは、その組が無いまま送る）
        let held = row.held;
        if (row.key !== undefined) {
          const entries = Array.from(value);
          const index = entries.findIndex(([itemKey]) =>
            Object.is(itemKey, row.key),
          );
          held = { value: value.get(row.key), index };
          write(new Map(entries.filter((_, i) => i !== index)));
        }
        setRows((currentRows) =>
          currentRows.map((item) =>
            item.id === row.id
              ? { ...item, key: undefined, held, draftKey, keyError }
              : item,
          ),
        );
        return;
      }
      // キーの順を保ったまま、キーだけを差し替える。書きかけで外した組は、持っておいた値で元の位置に戻す。
      // 新しい行は末尾に値の無い組を足す
      const entries = Array.from(value);
      const next =
        row.key !== undefined
          ? new Map(
              entries.map(([itemKey, itemValue]) =>
                Object.is(itemKey, row.key)
                  ? [key, itemValue]
                  : [itemKey, itemValue],
              ),
            )
          : row.held
            ? new Map([
                ...entries.slice(0, row.held.index),
                [key, row.held.value],
                ...entries.slice(row.held.index),
              ])
            : new Map([...entries, [key, undefined]]);
      write(next);
      setRows((currentRows) =>
        currentRows.map((item) =>
          item.id === row.id
            ? { ...item, key, held: undefined, draftKey, keyError: undefined }
            : item,
        ),
      );
    };

    const handleValueChange = (key: MapKey, itemValue: unknown) => {
      const next = new Map(value);
      next.set(key, itemValue);
      write(next);
    };

    return (
      <InputWrapper
        label={label || undefined}
        required={!(optional || nullable)}
        error={error?.message ?? (showErrors ? mapError : undefined)}
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
          {rows.map((row) => {
            const errors =
              showErrors && row.key !== undefined
                ? rowErrors.get(row.key)
                : undefined;
            return (
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
                      error={row.keyError ?? errors?.key}
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
                      {row.key !== undefined ? (
                        <MapValueInput
                          schema={valueSchema}
                          value={value.get(row.key)}
                          error={errors?.value}
                          readOnly={readOnly}
                          label={msg(
                            "zodFormMantine.record.value" /* i18n: 値 */,
                          )}
                          onChange={(itemValue) =>
                            handleValueChange(row.key as MapKey, itemValue)
                          }
                          onBlur={field.onBlur}
                        />
                      ) : (
                        <TextInput
                          label={msg(
                            "zodFormMantine.record.value" /* i18n: 値 */,
                          )}
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
                          msg(
                            "zodFormMantine.record.emptyRow" /* i18n: 空の行 */,
                          ),
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
            );
          })}
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
                onClick={() =>
                  setRows((currentRows) => [
                    ...currentRows,
                    createEntryRow(undefined),
                  ])
                }
              >
                <IconCirclePlus />
              </ActionIcon>
            </div>
          )}
        </div>
      </InputWrapper>
    );
  },
);

/** キー・値の型を確かめ、描けなければ注記を出す */
const MapComponent = (props: ZodFormProps<MapSchema>) => {
  const meta = useResolvedMeta(props.schema);
  const keyType = (props.schema.def.keyType as z.ZodTypeAny).type;
  const valueType = (props.schema.def.valueType as z.ZodTypeAny).type;
  if (!KEY_TYPES.has(keyType) || !VALUE_TYPES.has(valueType)) {
    return (
      <UnsupportedNotice
        fieldPath={props.fieldPath}
        label={props.label ?? (meta as { label?: string } | undefined)?.label}
        reason={`map of ${keyType} to ${valueType} is not supported (keys: string or number; values: string, number, boolean, or enum)`}
      />
    );
  }
  return <MapEntriesComponent {...props} />;
};

export { MapComponent as component };
