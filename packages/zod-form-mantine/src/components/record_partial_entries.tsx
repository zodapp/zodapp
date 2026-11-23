import { useMsg } from "../messages/useMsg";
import { useResolvedMeta, useResolveText } from "@zodapp/zod-form-react/common";
import React from "react";
import z from "zod";
import {
  ContainerMarker,
  ZodFormInternalProps,
  PRESENCE_BY_PARENT_OUTER,
  wrapComponent,
  isUnsafeFieldKey,
} from "@zodapp/zod-form-react/common";
import { partialRecordKeys } from "@zodapp/zod-form";
import { ownsContainerMarker } from "./container";
import { keyLabelsOf } from "./record";
import { UnsafeRecordEntry } from "../utils/unsafeKey";
import {
  EntriesFrame,
  EntriesScroller,
  EntryContent,
  EntryAddSelect,
  EntryRow,
  addedEntryValue,
  entryWidthOf,
  isHorizontalEntries,
  isOptionalProperty,
  useEntriesValue,
  useHorizontalEntries,
} from "./entries_layout";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

const joinFieldPath = (fieldPath: string, key: string) =>
  fieldPath + (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") + key;

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
 * 行の並びは meta の keyOrder で決める。
 * `uiType: "entries-horizontal"` では、行をカードにして横一列に並べる（object の entries と同じ）
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
      | { label?: string; uiType?: string; keyOrder?: "definition" | "value" }
      | undefined;
    const msg = useMsg();
    const resolveText = useResolveText();
    const valueSchema = schema.def.valueType;
    const candidates = partialRecordKeys(schema) ?? [];
    const labels = keyLabelsOf(schema);
    const keyLabel = (key: string) => resolveText(labels.get(key)) ?? key;
    const { value: fieldValue, setValue } = useEntriesValue(fieldPath, field);
    const value = (fieldValue ?? defaultValue ?? {}) as Record<string, unknown>;
    const valueKeys = Object.keys(value);
    const keys = orderPartialRecordKeys(valueKeys, candidates, meta?.keyOrder);
    const usedKeys = new Set(valueKeys);
    const unusedKeys = candidates.filter((key) => !usedKeys.has(key));
    const label = labelFromParent ?? meta?.label;

    // entries-horizontal：カードを横に並べる（幅は値の schema で決まり、どのキーも同じ）
    const horizontal = isHorizontalEntries(meta?.uiType);
    const cardWidth = entryWidthOf(valueSchema);
    const { scrollerRef, scrollTo } = useHorizontalEntries();

    const handleAdd = (key: string) => {
      if (usedKeys.has(key)) return;
      // 足したキーは値の object の末尾に入れる（keyOrder: value のとき、足した順に並ぶ）
      setValue({ ...value, [key]: addedEntryValue(valueSchema) });
      // 横並びでは、足したカードが見えるところまでスクロールする
      if (horizontal) scrollTo(key);
    };

    const handleRemove = (key: string) => {
      const nextValue = { ...value };
      delete nextValue[key];
      setValue(nextValue);
      // 配下の欄に残ったエラーの meta を消す（object の entries と同じ）
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

    // 値の schema が optional なら、行の有る・無いを親が扱う（子は取り消しの UI を出さず、空にすると undefined）
    const valueOuter = isOptionalProperty(valueSchema)
      ? PRESENCE_BY_PARENT_OUTER
      : undefined;

    const rows = keys.map((key) =>
      isUnsafeFieldKey(key) ? (
        <UnsafeRecordEntry
          key={key}
          recordPath={fieldPath}
          entryKey={key}
          readOnly={readOnly}
          onRemove={() => handleRemove(key)}
        />
      ) : (
        <EntryRow
          key={key}
          label={keyLabel(key)}
          readOnly={readOnly}
          horizontal={horizontal}
          width={cardWidth}
          entryKey={key}
          onRemove={() => handleRemove(key)}
          removeLabel={msg(
            "zodFormMantine.record.removeRow" /* i18n: ${label}を削除 */,
            { label: keyLabel(key) },
          )}
        >
          <EntryContent
            fieldPath={joinFieldPath(fieldPath, key)}
            schema={valueSchema}
            defaultValue={value[key]}
            outer={valueOuter}
            readOnly={readOnly}
            label={false}
          />
        </EntryRow>
      ),
    );

    return (
      <EntriesFrame label={label} error={error?.message}>
        {horizontal ? (
          <EntriesScroller scrollerRef={scrollerRef}>{rows}</EntriesScroller>
        ) : (
          rows
        )}
        {ownsContainerMarker({ hideError, errorToken }) && (
          <ContainerMarker fieldPath={fieldPath} />
        )}
        {!readOnly && (
          <EntryAddSelect
            options={unusedKeys.map((key) => ({
              value: key,
              label: keyLabel(key),
            }))}
            onAdd={handleAdd}
            placeholder={msg(
              "zodFormMantine.record.addKey" /* i18n: キーを追加 */,
            )}
            horizontal={horizontal}
          />
        )}
      </EntriesFrame>
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
