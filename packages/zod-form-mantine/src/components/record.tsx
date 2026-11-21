import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useEffect, useMemo } from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import z from "zod";
import {
  Switch,
  ContainerMarker,
  ZodFormInternalProps,
  type ZodFormProps,
  wrapComponent,
  isUnsafeFieldKey,
} from "@zodapp/zod-form-react/common";
import { containerWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import {
  enumeratedRecordKeys,
  getMeta,
  partialRecordKeys,
} from "@zodapp/zod-form";
import { useResolveText } from "@zodapp/zod-form-react/common";
import { FieldContainer, isFlatSchema, ownsContainerMarker } from "./container";
import { UnsafeKeyNameNotice, UnsafeRecordEntry } from "../utils/unsafeKey";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

const joinFieldPath = (fieldPath: string, key: string) => {
  return (
    fieldPath + (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") + key
  );
};

/**
 * キーの決まった record のキーの名前。キーの schema の選択肢に label があればそれを使う
 * （`zf.enum` の literal、literal の union の腕）。無ければキーそのもの
 */
export const keyLabelsOf = (
  schema: RecordSchema,
): Map<string, string | undefined> => {
  const keyType = schema.def.keyType as z.ZodTypeAny;
  const labels = new Map<string, string | undefined>();
  const enumSchemas = (
    getMeta(keyType) as { schemas?: Record<string, z.ZodTypeAny> } | undefined
  )?.schemas;
  for (const [key, literal] of Object.entries(enumSchemas ?? {})) {
    labels.set(key, getMeta(literal)?.label || undefined);
  }
  if (keyType.type === "union") {
    for (const arm of (keyType as z.ZodUnion).def.options as z.ZodTypeAny[]) {
      const values = (arm.def as { values?: unknown[] }).values ?? [];
      const label = getMeta(arm)?.label || undefined;
      for (const value of values) labels.set(String(value), label);
    }
  }
  return labels;
};

/**
 * キーの決まった record（キーの schema が enum・literal・literal の union など）。
 * zod はすべてのキーを必須として検証するので、列挙したキーを固定の欄として、object と同じように並べる。
 * キーの追加・名前の変更はできない（uiType が entries でも、この見た目にする）。
 * 値にあって列挙に無いキーは描かない（zod の unrecognized_keys として record の欄に出る）
 */
const FixedKeysRecordBody = ({
  fieldPath,
  schema,
  defaultValue,
  readOnly,
  label: labelFromParent,
  error,
  hideError,
  errorToken,
  keys,
  valueSchema: valueSchemaOverride,
}: ZodFormInternalProps<RecordSchema> & {
  keys: string[];
  /** 欄に渡す値の schema（partialRecord では optional にしたもの）。省略すると record の値の schema */
  valueSchema?: z.ZodTypeAny;
}) => {
  const meta = useResolvedMeta(schema);
  const resolveText = useResolveText();
  const valueSchema = valueSchemaOverride ?? schema.def.valueType;
  const labels = keyLabelsOf(schema);
  const label = labelFromParent ?? meta?.label;
  // entries・entries-horizontal は固定のキーの見た目に無いので、既定の入れ物にする
  const uiType =
    meta?.uiType === "entries" || meta?.uiType === "entries-horizontal"
      ? undefined
      : meta?.uiType;
  return (
    <FieldContainer
      label={label}
      uiType={uiType}
      error={error?.message}
      trailing={
        ownsContainerMarker({ hideError, errorToken }) ? (
          <ContainerMarker fieldPath={fieldPath} />
        ) : undefined
      }
    >
      {keys.map((key) => ({
        key,
        flat: isFlatSchema(valueSchema) && !isUnsafeFieldKey(key),
        node: isUnsafeFieldKey(key) ? (
          <UnsafeKeyNameNotice
            parentPath={fieldPath}
            propertyKey={key}
            label={labels.get(key)}
          />
        ) : (
          <Switch
            fieldPath={joinFieldPath(fieldPath, key)}
            schema={valueSchema}
            defaultValue={
              (defaultValue as Record<string, unknown> | undefined)?.[key]
            }
            outer={undefined}
            readOnly={readOnly}
            label={
              resolveText(labels.get(key)) ??
              getMeta(schema.def.valueType)?.label ??
              key
            }
          />
        ),
      }))}
    </FieldContainer>
  );
};

/** キーの決まった record の部品（record・record_entries の両方から使う） */
export const FixedKeysRecordComponent = wrapComponent(
  function FixedKeysRecordComponentImplement(
    props: ZodFormInternalProps<RecordSchema>,
  ) {
    return (
      <FixedKeysRecordBody
        {...props}
        keys={enumeratedRecordKeys(props.schema) ?? []}
      />
    );
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    invalid: false,
  },
);

/** 値が undefined のキーを消した object。消すキーが無ければ undefined */
export const withoutUndefinedEntries = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.some(([, v]) => v === undefined)) return undefined;
  return Object.fromEntries(entries.filter(([, v]) => v !== undefined));
};

/**
 * キーが enum・literal の `z.partialRecord`（既定の見た目）。
 * 候補のキーを全部、キーの決まった record と同じ固定の欄で並べ、各欄は値の schema を optional にして描く。
 * 欄が undefined を書いたら、値に undefined を入れずにキーごと消す
 * （zod の partialRecord は、値にあるキーの値を値の schema で検証するため）
 */
export const PartialFixedKeysRecordComponent = wrapComponent(
  function PartialFixedKeysRecordComponentImplement(
    props: ZodFormInternalProps<RecordSchema>,
  ) {
    const { field, schema } = props;
    const valueType = schema.def.valueType as z.ZodTypeAny;
    const optionalValueSchema = useMemo(
      () => (valueType.type === "optional" ? valueType : valueType.optional()),
      [valueType],
    );
    const pruned = withoutUndefinedEntries(field.value);
    useEffect(() => {
      if (pruned) field.onChange(pruned);
    }, [pruned, field]);
    return (
      <FixedKeysRecordBody
        {...props}
        keys={partialRecordKeys(schema) ?? []}
        valueSchema={optionalValueSchema}
      />
    );
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    invalid: false,
  },
);

const RecordComponent = wrapComponent(
  function RecordComponentImplement({
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
    const meta = useResolvedMeta(schema);
    const valueSchema = schema.def.valueType;

    const value = field.value ?? defaultValue;
    const keys = value ? Object.keys(value) : [];
    const label = labelFromParent ?? meta?.label;

    const handleRemoveUnsafe = (key: string) => {
      const nextValue = { ...(value as Record<string, unknown>) };
      delete nextValue[key];
      field.onChange(nextValue);
    };

    const fieldsComponent = keys.map((key: string) => (
      <div key={key}>
        {isUnsafeFieldKey(key) ? (
          <UnsafeRecordEntry
            recordPath={fieldPath}
            entryKey={key}
            readOnly={readOnly}
            onRemove={() => handleRemoveUnsafe(key)}
          />
        ) : (
          <Switch
            fieldPath={joinFieldPath(fieldPath, key)}
            schema={valueSchema}
            defaultValue={value?.[key]}
            outer={undefined}
            readOnly={readOnly}
            label={key}
          />
        )}
      </div>
    ));
    const marker = ownsContainerMarker({ hideError, errorToken }) ? (
      <ContainerMarker fieldPath={fieldPath} />
    ) : null;

    if (meta?.uiType === "box") {
      return (
        <Fieldset legend={label || undefined} mt={10}>
          <InputWrapper
            required={undefined}
            error={error?.message}
            labelElement="div"
          >
            {fieldsComponent}
            {marker}
          </InputWrapper>
        </Fieldset>
      );
    }

    return (
      <InputWrapper
        label={label || undefined}
        required={undefined}
        error={error?.message}
        labelElement="div"
        style={containerWrapperStyle(label)}
      >
        {fieldsComponent}
        {marker}
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

RecordComponent.displayName = "RecordComponent";

/**
 * キーを列挙できる record は固定のキーで、キーが enum・literal の partialRecord は固定のキー＋optional で、
 * それ以外は値にあるキーで描く
 */
const RecordSwitch = (props: ZodFormProps<RecordSchema>) =>
  enumeratedRecordKeys(props.schema) ? (
    <FixedKeysRecordComponent {...props} />
  ) : partialRecordKeys(props.schema) ? (
    <PartialFixedKeysRecordComponent {...props} />
  ) : (
    <RecordComponent {...props} />
  );

export { RecordSwitch as component };
