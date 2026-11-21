import { useResolvedMeta, useResolveText } from "@zodapp/zod-form-react/common";
import React from "react";
import { zf, getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  Switch,
  ContainerMarker,
  ZodFormInternalProps,
  PRESENCE_BY_PARENT_OUTER,
  wrapComponent,
  emptinessOf,
  isUnsafeFieldKey,
} from "@zodapp/zod-form-react/common";
import { ownsContainerMarker } from "./container";
import { OptionalContainer } from "./object";
import {
  EntriesFrame,
  EntryAddSelect,
  EntryRow,
  addedEntryValue,
  isOptionalProperty,
} from "./entries_layout";
import { useMsg } from "../messages/useMsg";
import { UnsafeKeyNameNotice } from "../utils/unsafeKey";

type ObjectSchema = ReturnType<typeof zf.object>;

const joinFieldPath = (fieldPath: string, propertyName: string) =>
  fieldPath +
  (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") +
  propertyName;

const WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "nonoptional",
  "readonly",
  "catch",
]);

/**
 * 項目の label。包み（optional・nullable・default など）と pipe（transform の入口）を外へから内へたどり、
 * 最初に見つかった label を使う（`.optional()` の内側に register した書き方でも名前が出る）
 */
export const propertyLabelOf = (schema: z.ZodTypeAny): string | undefined => {
  let current: z.ZodTypeAny | undefined = schema;
  const seen = new Set<z.ZodTypeAny>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const label = getMeta(current)?.label;
    if (label) return label;
    const def = current.def as {
      type?: string;
      innerType?: z.ZodTypeAny;
      in?: z.ZodTypeAny;
    };
    current =
      def.type && WRAPPER_TYPES.has(def.type)
        ? def.innerType
        : def.type === "pipe"
          ? def.in
          : undefined;
  }
  return undefined;
};

/**
 * 行の並び（keyOrder）。definition（既定）は定義の順、value は値の object の順
 * （値に無い必須の項目は後ろ）
 */
export const orderObjectEntries = (
  definitionOrder: string[],
  shown: Set<string>,
  valueKeys: string[],
  keyOrder: "definition" | "value" | undefined,
): string[] => {
  if (keyOrder !== "value")
    return definitionOrder.filter((key) => shown.has(key));
  const fromValue = valueKeys.filter((key) => shown.has(key));
  const placed = new Set(fromValue);
  return [
    ...fromValue,
    ...definitionOrder.filter((key) => shown.has(key) && !placed.has(key)),
  ];
};

/**
 * object を `uiType: "entries"` で描く部品。
 * optional の項目（キーが無くても通る項目）は、値にキーがあるときだけ行として出し（undefined でもキーがあれば出す）、
 * ⊖ でキーごと消す。いちばん下の選択で、まだ値に無い optional の項目を足す。必須の項目は常に出し、⊖ は付けない。
 * optional の項目の行には {@link PRESENCE_BY_PARENT_OUTER} を渡すので、子は取り消しの UI を出さず、空にすると undefined を書く
 * （キーは残るので行は残り、JSON にすると消える）。
 * 行の名前は行が描き、子には label を渡さない（行の上に必須の印が付かない）
 */
function ObjectEntriesBody({
  fieldPath,
  schema,
  defaultValue,
  readOnly,
  label: labelFromParent,
  error,
  field,
  hideError,
  errorToken,
}: ZodFormInternalProps<ObjectSchema>) {
  const meta = useResolvedMeta(schema) as
    | {
        label?: string;
        properties?: string[];
        keyOrder?: "definition" | "value";
      }
    | undefined;
  const msg = useMsg();
  const resolveText = useResolveText();
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const definitionOrder = (meta?.properties ?? Object.keys(shape)).filter(
    (key) => {
      const propertySchema = shape[key];
      if (!propertySchema) return false;
      const propertyMeta = getMeta(propertySchema);
      return !(propertyMeta?.hidden || propertyMeta?.typeName === "hidden");
    },
  );
  const value =
    ((field.value ?? defaultValue ?? {}) as Record<string, unknown>) ?? {};
  const valueKeys = Object.keys(value);
  const isOptionalKey = (key: string) => isOptionalProperty(shape[key]!);
  const shown = new Set(
    definitionOrder.filter((key) => !isOptionalKey(key) || key in value),
  );
  const keys = orderObjectEntries(
    definitionOrder,
    shown,
    valueKeys,
    meta?.keyOrder,
  );
  const labelOf = (key: string) =>
    resolveText(propertyLabelOf(shape[key]!)) ?? key;
  const addable = definitionOrder.filter(
    (key) => isOptionalKey(key) && !shown.has(key) && !isUnsafeFieldKey(key),
  );

  const handleAdd = (key: string) => {
    if (key in value) return;
    // 足したキーは値の object の末尾に入れる（keyOrder: value のとき、足した順に並ぶ）
    field.onChange({ ...value, [key]: addedEntryValue(shape[key]!) });
  };

  const handleRemove = (key: string) => {
    const nextValue = { ...value };
    delete nextValue[key];
    field.onChange(nextValue);
    // 配下の欄に残ったエラーの meta を消す（OptionalContainer と同じ）
    const path = joinFieldPath(fieldPath, key);
    const form = field.api.form;
    const fieldMeta = form.state.fieldMeta as Record<string, unknown>;
    Object.keys(fieldMeta)
      .filter((name) => name === path || name.startsWith(`${path}.`))
      .forEach((name) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setFieldMeta(name, (prev: any) => ({
          ...prev,
          errors: [],
          errorMap: {},
          errorSourceMap: {},
        }));
      });
  };

  const label = labelFromParent ?? meta?.label;

  return (
    <EntriesFrame label={label} error={error?.message}>
      {keys.map((key) => {
        const optional = isOptionalKey(key);
        const keyLabel = labelOf(key);
        return (
          <EntryRow
            key={key}
            label={keyLabel}
            readOnly={readOnly}
            onRemove={optional ? () => handleRemove(key) : undefined}
            removeLabel={msg(
              "zodFormMantine.record.removeRow" /* i18n: ${label}を削除 */,
              { label: keyLabel },
            )}
          >
            {isUnsafeFieldKey(key) ? (
              <UnsafeKeyNameNotice
                parentPath={fieldPath}
                propertyKey={key}
                label={keyLabel}
              />
            ) : (
              <Switch
                fieldPath={joinFieldPath(fieldPath, key)}
                schema={shape[key]!}
                defaultValue={value[key]}
                outer={optional ? PRESENCE_BY_PARENT_OUTER : undefined}
                readOnly={readOnly}
                label={false}
              />
            )}
          </EntryRow>
        );
      })}
      {ownsContainerMarker({ hideError, errorToken }) && (
        <ContainerMarker fieldPath={fieldPath} />
      )}
      {!readOnly && (
        <EntryAddSelect
          options={addable.map((key) => ({ value: key, label: labelOf(key) }))}
          onAdd={handleAdd}
          placeholder={msg(
            "zodFormMantine.object.addField" /* i18n: 項目を追加 */,
          )}
        />
      )}
    </EntriesFrame>
  );
}

const ObjectEntriesComponent = wrapComponent(
  function ObjectEntriesComponentImplement(
    props: ZodFormInternalProps<ObjectSchema>,
  ) {
    const { optional, nullable } = emptinessOf(props.outer);
    if ((optional || nullable) && props.fieldPath !== "") {
      return (
        <OptionalContainer {...props}>
          <ObjectEntriesBody {...props} outer={undefined} label={false} />
        </OptionalContainer>
      );
    }
    return <ObjectEntriesBody {...props} />;
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    invalid: false,
  },
);

ObjectEntriesComponent.displayName = "ObjectEntriesComponent";

export { ObjectEntriesComponent as component };
