import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import z from "zod";
import {
  Switch,
  ContainerMarker,
  ZodFormInternalProps,
  type ZodFormProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { enumeratedRecordKeys, getMeta } from "@zodapp/zod-form";
import { useResolveText } from "@zodapp/zod-form-react/common";
import { FieldContainer, isFlatSchema, ownsContainerMarker } from "./container";

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
const keyLabelsOf = (schema: RecordSchema): Map<string, string | undefined> => {
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
}: ZodFormInternalProps<RecordSchema> & { keys: string[] }) => {
  const meta = useResolvedMeta(schema);
  const resolveText = useResolveText();
  const valueSchema = schema.def.valueType;
  const labels = keyLabelsOf(schema);
  const label = labelFromParent ?? meta?.label;
  // entries は固定のキーの見た目に無いので、既定の入れ物にする
  const uiType = meta?.uiType === "entries" ? undefined : meta?.uiType;
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
        flat: isFlatSchema(valueSchema),
        node: (
          <Switch
            fieldPath={joinFieldPath(fieldPath, key)}
            schema={valueSchema}
            defaultValue={
              (defaultValue as Record<string, unknown> | undefined)?.[key]
            }
            outer={undefined}
            readOnly={readOnly}
            label={
              resolveText(labels.get(key)) ?? getMeta(valueSchema)?.label ?? key
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

    const fieldsComponent = keys.map((key: string) => (
      <div key={key}>
        <Switch
          fieldPath={joinFieldPath(fieldPath, key)}
          schema={valueSchema}
          defaultValue={value?.[key]}
          outer={undefined}
          readOnly={readOnly}
          label={key}
        />
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
        style={inputWrapperStyle}
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

/** キーを列挙できる record は固定のキーで、それ以外は値にあるキーで描く */
const RecordSwitch = (props: ZodFormProps<RecordSchema>) =>
  enumeratedRecordKeys(props.schema) ? (
    <FixedKeysRecordComponent {...props} />
  ) : (
    <RecordComponent {...props} />
  );

export { RecordSwitch as component };
