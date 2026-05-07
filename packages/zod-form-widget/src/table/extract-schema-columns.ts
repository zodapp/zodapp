import { getMetaReact } from "@zodapp/zod-form-react";
import { zf } from "@zodapp/zod-form";
import { z } from "zod";
import { getUnwrappedMeta } from "./table-types";

const DEFAULT_DISPLAY_LENGTH = 1;
const MAX_DYNAMIC_ARRAY_INDEX = 9;

export type SchemaColumnDef = {
  label: string;
  fieldPath: string;
  fieldKeys: string[];
  schema: z.ZodTypeAny;
  meta: ReturnType<typeof getUnwrappedMeta>;
  isDefault: boolean;
};

export type SchemaRecordTemplateDef = {
  label: string;
  templatePath: string;
  templateKeys: string[];
  schema: z.ZodTypeAny;
  meta: ReturnType<typeof getUnwrappedMeta>;
  isDefault: boolean;
};

type CollectColumnsContext = {
  maxSelectedArrayIndexByPrefix: ReadonlyMap<string, number>;
  selectedChildKeysByPrefix: ReadonlyMap<string, ReadonlySet<string>>;
};

function getLazyGetter(schema: z.ZodTypeAny): (() => z.ZodTypeAny) | undefined {
  return (
    (schema as unknown as {
      def?: { getter?: () => z.ZodTypeAny };
      _def?: { getter?: () => z.ZodTypeAny };
    }).def?.getter ??
    (schema as unknown as {
      def?: { getter?: () => z.ZodTypeAny };
      _def?: { getter?: () => z.ZodTypeAny };
    })._def?.getter
  );
}

function unwrapWrappers(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  const seen = new Set<z.ZodTypeAny>();

  while (!seen.has(current)) {
    seen.add(current);

    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault
    ) {
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }

    if (current instanceof z.ZodLazy) {
      const getter = getLazyGetter(current);
      if (!getter) break;
      current = getter();
      continue;
    }

    break;
  }
  return current;
}

function getRecordValueSchema(schema: z.ZodTypeAny): z.ZodTypeAny | undefined {
  const current = unwrapWrappers(schema);
  return (
    (current as unknown as {
      def?: { valueType?: z.ZodTypeAny };
      _def?: { valueType?: z.ZodTypeAny };
      valueType?: z.ZodTypeAny;
    }).def?.valueType ??
    (current as unknown as {
      def?: { valueType?: z.ZodTypeAny };
      _def?: { valueType?: z.ZodTypeAny };
      valueType?: z.ZodTypeAny;
    })._def?.valueType ??
    (current as unknown as {
      def?: { valueType?: z.ZodTypeAny };
      _def?: { valueType?: z.ZodTypeAny };
      valueType?: z.ZodTypeAny;
    }).valueType
  );
}

function getUnwrappedUnionMeta(schema: z.ZodTypeAny) {
  let current = schema;
  let meta = getMetaReact(current, "union");
  const seen = new Set<z.ZodTypeAny>();

  while (!seen.has(current)) {
    seen.add(current);

    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault
    ) {
      current = current.unwrap() as z.ZodTypeAny;
    } else if (current instanceof z.ZodLazy) {
      const getter = getLazyGetter(current);
      if (!getter) break;
      current = getter();
    } else {
      break;
    }

    const innerMeta = getMetaReact(current, "union");
    meta = (
      meta && innerMeta ? { ...innerMeta, ...meta } : (meta ?? innerMeta)
    ) as typeof meta;
  }

  return meta;
}

function buildMaxSelectedArrayIndexByPrefix(
  selectedFieldPaths?: string[],
): Map<string, number> {
  const maxIndexByPrefix = new Map<string, number>();

  for (const fieldPath of selectedFieldPaths ?? []) {
    if (!fieldPath) continue;

    const tokens = fieldPath.split(".").filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || !isArrayIndexKey(token) || i === 0) continue;

      const prefixKey = tokens.slice(0, i).join(".");
      if (!prefixKey) continue;

      const index = Number(token);
      const prevMaxIndex = maxIndexByPrefix.get(prefixKey);
      if (prevMaxIndex == null || index > prevMaxIndex) {
        maxIndexByPrefix.set(prefixKey, index);
      }
    }
  }

  return maxIndexByPrefix;
}

function buildSelectedChildKeysByPrefix(
  selectedFieldPaths?: string[],
): Map<string, Set<string>> {
  const childKeysByPrefix = new Map<string, Set<string>>();

  for (const fieldPath of selectedFieldPaths ?? []) {
    if (!fieldPath) continue;

    const tokens = fieldPath.split(".").filter(Boolean);
    const prefixTokens: string[] = [];

    for (const token of tokens) {
      const prefixKey = prefixTokens.join(".");
      let keys = childKeysByPrefix.get(prefixKey);
      if (!keys) {
        keys = new Set<string>();
        childKeysByPrefix.set(prefixKey, keys);
      }
      keys.add(token);
      prefixTokens.push(token);
    }
  }

  return childKeysByPrefix;
}

function getArrayDisplayLength(
  originalFieldSchema: z.ZodTypeAny,
  prefixKeys: string[],
  context: CollectColumnsContext,
): number {
  const arrayMeta = getMetaReact(originalFieldSchema, "array");
  const displayLength =
    (arrayMeta?.displayLength as number | undefined) ?? DEFAULT_DISPLAY_LENGTH;
  const baseMaxIndex = Math.max(displayLength - 1, -1);
  const selectedMaxIndex = context.maxSelectedArrayIndexByPrefix.get(
    prefixKeys.join("."),
  );
  const expandedMaxIndex =
    selectedMaxIndex == null
      ? baseMaxIndex
      : Math.max(baseMaxIndex, Math.min(selectedMaxIndex + 1, MAX_DYNAMIC_ARRAY_INDEX));

  return Math.max(expandedMaxIndex + 1, 0);
}

function addSchemaColumn(
  result: Map<string, SchemaColumnDef>,
  fieldKeys: string[],
  schema: z.ZodTypeAny,
  label: string,
  isDefault: boolean,
): void {
  const fieldPath = fieldKeys.join(".");
  if (result.has(fieldPath)) return;

  result.set(fieldPath, {
    label,
    fieldPath,
    fieldKeys,
    schema,
    meta: getUnwrappedMeta(schema),
    isDefault,
  });
}

function isSingleCellValueSchema(schema: z.ZodTypeAny): boolean {
  const inner = unwrapWrappers(schema);

  if (
    inner instanceof z.ZodString ||
    inner instanceof z.ZodNumber ||
    inner instanceof z.ZodBoolean ||
    inner instanceof z.ZodDate ||
    inner instanceof z.ZodEnum ||
    inner instanceof z.ZodLiteral ||
    inner instanceof z.ZodNever
  ) {
    return true;
  }

  if (inner instanceof z.ZodUnion) {
    return (inner.options as z.ZodTypeAny[]).every(isSingleCellValueSchema);
  }

  return false;
}

function isValidRecordKey(key: string): boolean {
  return key.length > 0 && !key.includes(".") && key !== "*";
}

export function isSupportedRecordKeyInput(input: string): boolean {
  return isValidRecordKey(input.trim());
}

export function resolveRecordTemplateConcretePath(
  templatePath: string,
  recordKeyInput: string,
): string | null {
  const recordKey = recordKeyInput.trim();
  if (!isValidRecordKey(recordKey)) return null;

  return templatePath
    .split(".")
    .map((segment) => (segment === "*" ? recordKey : segment))
    .join(".");
}

export function matchesRecordTemplatePath(
  templatePath: string,
  fieldPath: string,
): boolean {
  const templateSegments = templatePath.split(".").filter(Boolean);
  const pathSegments = fieldPath.split(".").filter(Boolean);
  if (templateSegments.length !== pathSegments.length) return false;

  return templateSegments.every((segment, index) => {
    if (segment === "*") {
      const token = pathSegments[index] ?? "";
      return isValidRecordKey(token);
    }
    return segment === pathSegments[index];
  });
}

export function resolveRecordTemplateLabel(
  templateLabel: string,
  templatePath: string,
  concretePath: string,
): string | null {
  if (!matchesRecordTemplatePath(templatePath, concretePath)) return null;

  const templateSegments = templatePath.split(".").filter(Boolean);
  const pathSegments = concretePath.split(".").filter(Boolean);
  const templateLabelSegments = templateLabel.split(".");

  const resolvedSegments: string[] = [];
  let labelIndex = 0;

  for (let i = 0; i < templateSegments.length; i++) {
    const templateSegment = templateSegments[i] ?? "";
    const pathSegment = pathSegments[i] ?? "";

    if (isArrayIndexKey(templateSegment)) continue;

    const labelSegment = templateLabelSegments[labelIndex] ?? templateSegment;
    resolvedSegments.push(templateSegment === "*" ? pathSegment : labelSegment);
    labelIndex += 1;
  }

  return resolvedSegments.join(".");
}

function buildPathDisplay(keys: string[]): string {
  const segments: string[] = [];

  for (const key of keys) {
    if (isArrayIndexKey(key) && segments.length > 0) {
      segments[segments.length - 1] = `${segments[segments.length - 1]}[${key}]`;
      continue;
    }
    segments.push(key);
  }

  return segments.join(".");
}

function collectFromArray(
  arraySchema: z.ZodTypeAny,
  originalFieldSchema: z.ZodTypeAny,
  prefixKeys: string[],
  fieldLabel: string,
  result: Map<string, SchemaColumnDef>,
  context: CollectColumnsContext,
  isDefault = true,
): void {
  const displayLength = getArrayDisplayLength(
    originalFieldSchema,
    prefixKeys,
    context,
  );
  const elementSchema = (arraySchema as unknown as { element: z.ZodTypeAny }).element;
  const elementInner = unwrapWrappers(elementSchema);

  for (let i = 0; i < displayLength; i++) {
    const indexKey = String(i);
    const elementKeys = [...prefixKeys, indexKey];

    if (elementInner instanceof z.ZodObject) {
      collectFromObject(elementInner, elementKeys, result, context, isDefault);
    } else if (
      elementInner instanceof z.ZodUnion ||
      elementInner instanceof z.ZodDiscriminatedUnion ||
      elementInner instanceof z.ZodIntersection
    ) {
      collectColumns(elementInner, elementKeys, result, context, isDefault);
    } else if (elementInner instanceof z.ZodArray) {
      collectFromArray(
        elementInner,
        elementSchema,
        elementKeys,
        fieldLabel,
        result,
        context,
        isDefault,
      );
    } else if (elementInner instanceof z.ZodRecord) {
      collectFromRecord(elementSchema, elementKeys, result, context, isDefault);
    } else {
      const meta = getUnwrappedMeta(elementSchema);
      addSchemaColumn(
        result,
        elementKeys,
        elementSchema,
        `${meta.label ?? fieldLabel}[${i}]`,
        isDefault,
      );
    }
  }
}

function collectFromRecord(
  recordSchema: z.ZodTypeAny,
  prefixKeys: string[],
  result: Map<string, SchemaColumnDef>,
  context: CollectColumnsContext,
  isDefault = true,
): void {
  const selectedKeys = context.selectedChildKeysByPrefix.get(prefixKeys.join("."));
  if (!selectedKeys?.size) return;

  const valueSchema = getRecordValueSchema(recordSchema);
  if (!valueSchema) return;

  const fieldLabel =
    getUnwrappedMeta(valueSchema).label ?? prefixKeys[prefixKeys.length - 1] ?? "";

  for (const selectedKey of selectedKeys) {
    if (!isValidRecordKey(selectedKey)) continue;

    const concreteKeys = [...prefixKeys, selectedKey];
    const valueInner = unwrapWrappers(valueSchema);

    if (valueInner instanceof z.ZodObject) {
      collectFromObject(valueInner, concreteKeys, result, context, isDefault);
    } else if (
      valueInner instanceof z.ZodUnion ||
      valueInner instanceof z.ZodDiscriminatedUnion ||
      valueInner instanceof z.ZodIntersection
    ) {
      collectColumns(valueSchema, concreteKeys, result, context, isDefault);
    } else if (valueInner instanceof z.ZodArray) {
      collectFromArray(
        valueInner,
        valueSchema,
        concreteKeys,
        fieldLabel,
        result,
        context,
        isDefault,
      );
    } else if (valueInner instanceof z.ZodRecord) {
      collectFromRecord(valueInner, concreteKeys, result, context, isDefault);
    } else {
      addSchemaColumn(
        result,
        concreteKeys,
        valueSchema,
        getUnwrappedMeta(valueSchema).label ?? selectedKey,
        isDefault,
      );
    }
  }
}

function collectFromObject(
  schema: z.ZodObject<z.ZodRawShape>,
  prefixKeys: string[],
  result: Map<string, SchemaColumnDef>,
  context: CollectColumnsContext,
  parentIsDefault = true,
): void {
  const tableMeta = getMetaReact(schema, "object");
  const properties: string[] | undefined = tableMeta?.properties as string[] | undefined;
  const allKeys = Object.keys(schema.shape);

  const propertySet = properties ? new Set<string>(properties) : null;
  const order = properties && propertySet
    ? [...properties, ...allKeys.filter((k) => !propertySet.has(k))]
    : allKeys;

  for (const key of order) {
    const fieldSchema = schema.shape[key] as z.ZodTypeAny | undefined;
    if (!fieldSchema) continue;

    const fieldKeys = [...prefixKeys, key];
    const meta = getUnwrappedMeta(fieldSchema);
    const isDefault = parentIsDefault && (propertySet == null || propertySet.has(key));

    if (meta.hidden || meta.typeName === "hidden" || meta.tags?.includes("hidden")) continue;
    if (key.startsWith("__")) continue;
    if (meta.label == null) continue;

    const inner = unwrapWrappers(fieldSchema);

    if (inner instanceof z.ZodObject) {
      collectFromObject(inner, fieldKeys, result, context, isDefault);
    } else if (
      inner instanceof z.ZodUnion ||
      inner instanceof z.ZodDiscriminatedUnion ||
      inner instanceof z.ZodIntersection
    ) {
      collectColumns(fieldSchema, fieldKeys, result, context, isDefault);
    } else if (inner instanceof z.ZodArray) {
      collectFromArray(
        inner,
        fieldSchema,
        fieldKeys,
        meta.label,
        result,
        context,
        isDefault,
      );
    } else if (inner instanceof z.ZodRecord) {
      collectFromRecord(fieldSchema, fieldKeys, result, context, isDefault);
    } else {
      addSchemaColumn(result, fieldKeys, fieldSchema, meta.label ?? key, isDefault);
    }
  }
}

function addRecordTemplate(
  result: Map<string, SchemaRecordTemplateDef>,
  templateKeys: string[],
  schema: z.ZodTypeAny,
  label: string,
  isDefault: boolean,
): void {
  const templatePath = templateKeys.join(".");
  if (result.has(templatePath)) return;

  result.set(templatePath, {
    label,
    templatePath,
    templateKeys,
    schema,
    meta: getUnwrappedMeta(schema),
    isDefault,
  });
}

function collectRecordTemplatesFromArray(
  arraySchema: z.ZodTypeAny,
  originalFieldSchema: z.ZodTypeAny,
  prefixKeys: string[],
  result: Map<string, SchemaRecordTemplateDef>,
  context: CollectColumnsContext,
  includeLeafTemplates = false,
  isDefault = true,
): void {
  const displayLength = getArrayDisplayLength(
    originalFieldSchema,
    prefixKeys,
    context,
  );
  const elementSchema = (arraySchema as unknown as { element: z.ZodTypeAny }).element;
  const elementInner = unwrapWrappers(elementSchema);

  for (let i = 0; i < displayLength; i++) {
    const elementKeys = [...prefixKeys, String(i)];

    if (elementInner instanceof z.ZodObject) {
      collectRecordTemplatesFromObject(
        elementInner,
        elementKeys,
        result,
        context,
        includeLeafTemplates,
        isDefault,
      );
    } else if (
      elementInner instanceof z.ZodUnion ||
      elementInner instanceof z.ZodDiscriminatedUnion ||
      elementInner instanceof z.ZodIntersection
    ) {
      collectRecordTemplates(
        elementSchema,
        elementKeys,
        result,
        context,
        isDefault,
      );
    } else if (elementInner instanceof z.ZodArray) {
      collectRecordTemplatesFromArray(
        elementInner,
        elementSchema,
        elementKeys,
        result,
        context,
        includeLeafTemplates,
        isDefault,
      );
    } else if (elementInner instanceof z.ZodRecord) {
      collectRecordTemplatesFromRecord(
        elementSchema,
        elementKeys,
        result,
        context,
        isDefault,
      );
    } else if (includeLeafTemplates) {
      addRecordTemplate(
        result,
        elementKeys,
        elementSchema,
        buildPathDisplay(elementKeys),
        isDefault,
      );
    }
  }
}

function collectRecordTemplatesFromRecord(
  recordSchema: z.ZodTypeAny,
  prefixKeys: string[],
  result: Map<string, SchemaRecordTemplateDef>,
  context: CollectColumnsContext,
  isDefault = true,
): void {
  const valueSchema = getRecordValueSchema(recordSchema);
  if (!valueSchema) return;

  const templateKeys = [...prefixKeys, "*"];
  const valueInner = unwrapWrappers(valueSchema);

  if (isSingleCellValueSchema(valueSchema)) {
    addRecordTemplate(
      result,
      templateKeys,
      valueSchema,
      buildPathDisplay(templateKeys),
      isDefault,
    );
  } else if (valueInner instanceof z.ZodObject) {
    collectRecordTemplatesFromObject(
      valueInner,
      templateKeys,
      result,
      context,
      true,
      isDefault,
    );
  } else if (
    valueInner instanceof z.ZodUnion ||
    valueInner instanceof z.ZodDiscriminatedUnion ||
    valueInner instanceof z.ZodIntersection
  ) {
    collectRecordTemplates(valueSchema, templateKeys, result, context, isDefault);
  } else if (valueInner instanceof z.ZodArray) {
    collectRecordTemplatesFromArray(
      valueInner,
      valueSchema,
      templateKeys,
      result,
      context,
      true,
      isDefault,
    );
  } else if (valueInner instanceof z.ZodRecord) {
    collectRecordTemplatesFromRecord(
      valueSchema,
      templateKeys,
      result,
      context,
      isDefault,
    );
  } else {
    addRecordTemplate(
      result,
      templateKeys,
      valueSchema,
      buildPathDisplay(templateKeys),
      isDefault,
    );
  }
}

function collectRecordTemplatesFromObject(
  schema: z.ZodObject<z.ZodRawShape>,
  prefixKeys: string[],
  result: Map<string, SchemaRecordTemplateDef>,
  context: CollectColumnsContext,
  includeLeafTemplates = false,
  parentIsDefault = true,
): void {
  const tableMeta = getMetaReact(schema, "object");
  const properties: string[] | undefined = tableMeta?.properties as string[] | undefined;
  const allKeys = Object.keys(schema.shape);

  const propertySet = properties ? new Set<string>(properties) : null;
  const order = properties && propertySet
    ? [...properties, ...allKeys.filter((k) => !propertySet.has(k))]
    : allKeys;

  for (const key of order) {
    const fieldSchema = schema.shape[key] as z.ZodTypeAny | undefined;
    if (!fieldSchema) continue;

    const fieldKeys = [...prefixKeys, key];
    const meta = getUnwrappedMeta(fieldSchema);
    const isDefault = parentIsDefault && (propertySet == null || propertySet.has(key));

    if (meta.hidden || meta.typeName === "hidden" || meta.tags?.includes("hidden")) continue;
    if (key.startsWith("__")) continue;
    if (meta.label == null) continue;

    const inner = unwrapWrappers(fieldSchema);

    if (inner instanceof z.ZodObject) {
      collectRecordTemplatesFromObject(
        inner,
        fieldKeys,
        result,
        context,
        includeLeafTemplates,
        isDefault,
      );
    } else if (
      inner instanceof z.ZodUnion ||
      inner instanceof z.ZodDiscriminatedUnion ||
      inner instanceof z.ZodIntersection
    ) {
      collectRecordTemplates(fieldSchema, fieldKeys, result, context, isDefault);
    } else if (inner instanceof z.ZodArray) {
      collectRecordTemplatesFromArray(
        inner,
        fieldSchema,
        fieldKeys,
        result,
        context,
        includeLeafTemplates,
        isDefault,
      );
    } else if (inner instanceof z.ZodRecord) {
      collectRecordTemplatesFromRecord(
        fieldSchema,
        fieldKeys,
        result,
        context,
        isDefault,
      );
    } else if (includeLeafTemplates) {
      addRecordTemplate(
        result,
        fieldKeys,
        fieldSchema,
        buildPathDisplay(fieldKeys),
        isDefault,
      );
    }
  }
}

/**
 * ZodDiscriminatedUnion の各分岐から discriminatorKey に対応する literal を再帰的に収集する。
 * 分岐がさらに ZodDiscriminatedUnion や ZodUnion の場合も掘り下げる。
 */
function collectDiscriminatorLiterals(
  options: z.ZodTypeAny[],
  discriminatorKey: string,
  literals: z.ZodLiteral<string>[],
  seen: Set<string>,
): void {
  for (const option of options) {
    const optInner = unwrapWrappers(option);
    if (optInner instanceof z.ZodObject) {
      const discSchema = optInner.shape[discriminatorKey] as z.ZodTypeAny | undefined;
      const discInner = discSchema ? unwrapWrappers(discSchema) : undefined;
      if (discInner instanceof z.ZodLiteral && !seen.has(String(discInner.value))) {
        seen.add(String(discInner.value));
        literals.push(discInner as z.ZodLiteral<string>);
      }
    } else if (optInner instanceof z.ZodDiscriminatedUnion || optInner instanceof z.ZodUnion) {
      collectDiscriminatorLiterals(optInner.options as z.ZodTypeAny[], discriminatorKey, literals, seen);
    }
  }
}

function collectColumns(
  schema: z.ZodTypeAny,
  prefixKeys: string[],
  result: Map<string, SchemaColumnDef>,
  context: CollectColumnsContext,
  isDefault = true,
): void {
  const inner = unwrapWrappers(schema);

  if (inner instanceof z.ZodObject) {
    collectFromObject(inner, prefixKeys, result, context, isDefault);
    return;
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const discriminatorKey = (
      (inner as unknown as { _def: { discriminator?: string }})._def.discriminator
      ?? (inner as unknown as { discriminator?: string }).discriminator
      ?? ""
    );

    if (discriminatorKey) {
      const fieldKeys = [...prefixKeys, discriminatorKey];
      const fieldPath = fieldKeys.join(".");

      if (!result.has(fieldPath)) {
        const unionMeta = getUnwrappedUnionMeta(schema);
        const label =
          (unionMeta?.selectorLabel as string | undefined) ?? discriminatorKey;

        const literals: z.ZodLiteral<string>[] = [];
        const seen = new Set<string>();
        collectDiscriminatorLiterals(inner.options as z.ZodTypeAny[], discriminatorKey, literals, seen);

        const discriminatorSchema = literals.length > 0
          ? zf.enum(literals as unknown as readonly [z.ZodLiteral<string>, ...z.ZodLiteral<string>[]])
          : z.string();

        result.set(fieldPath, {
          label,
          fieldPath,
          fieldKeys,
          schema: discriminatorSchema,
          meta: getUnwrappedMeta(discriminatorSchema),
          isDefault,
        });
      }
    }

    const options = inner.options as z.ZodTypeAny[];
    for (const option of options) {
      collectColumns(option, prefixKeys, result, context, isDefault);
    }
    return;
  }

  if (inner instanceof z.ZodUnion) {
    if (prefixKeys.length > 0 && isSingleCellValueSchema(schema)) {
      const meta = getUnwrappedMeta(schema);
      addSchemaColumn(
        result,
        prefixKeys,
        schema,
        meta.label ?? prefixKeys[prefixKeys.length - 1] ?? "",
        isDefault,
      );
      return;
    }

    const options = inner.options as z.ZodTypeAny[];
    for (const option of options) {
      collectColumns(option, prefixKeys, result, context, isDefault);
    }
    return;
  }

  if (inner instanceof z.ZodIntersection) {
    collectColumns(
      inner._def.left as z.ZodTypeAny,
      prefixKeys,
      result,
      context,
      isDefault,
    );
    collectColumns(
      inner._def.right as z.ZodTypeAny,
      prefixKeys,
      result,
      context,
      isDefault,
    );
    return;
  }

  if (inner instanceof z.ZodArray) {
    const meta = getUnwrappedMeta(schema);
    collectFromArray(
      inner,
      schema,
      prefixKeys,
      meta.label ?? (prefixKeys[prefixKeys.length - 1] ?? ""),
      result,
      context,
      isDefault,
    );
    return;
  }

  if (inner instanceof z.ZodRecord) {
    collectFromRecord(schema, prefixKeys, result, context, isDefault);
  }
}

function collectRecordTemplates(
  schema: z.ZodTypeAny,
  prefixKeys: string[],
  result: Map<string, SchemaRecordTemplateDef>,
  context: CollectColumnsContext,
  isDefault = true,
): void {
  const inner = unwrapWrappers(schema);

  if (inner instanceof z.ZodObject) {
    collectRecordTemplatesFromObject(
      inner,
      prefixKeys,
      result,
      context,
      false,
      isDefault,
    );
    return;
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    for (const option of inner.options as z.ZodTypeAny[]) {
      collectRecordTemplates(option, prefixKeys, result, context, isDefault);
    }
    return;
  }

  if (inner instanceof z.ZodUnion) {
    if (prefixKeys.length > 0 && isSingleCellValueSchema(schema)) {
      addRecordTemplate(
        result,
        prefixKeys,
        schema,
        buildPathDisplay(prefixKeys),
        isDefault,
      );
      return;
    }

    for (const option of inner.options as z.ZodTypeAny[]) {
      collectRecordTemplates(option, prefixKeys, result, context, isDefault);
    }
    return;
  }

  if (inner instanceof z.ZodIntersection) {
    collectRecordTemplates(
      inner._def.left as z.ZodTypeAny,
      prefixKeys,
      result,
      context,
      isDefault,
    );
    collectRecordTemplates(
      inner._def.right as z.ZodTypeAny,
      prefixKeys,
      result,
      context,
      isDefault,
    );
    return;
  }

  if (inner instanceof z.ZodArray) {
    collectRecordTemplatesFromArray(
      inner,
      schema,
      prefixKeys,
      result,
      context,
      false,
      isDefault,
    );
    return;
  }

  if (inner instanceof z.ZodRecord) {
    collectRecordTemplatesFromRecord(schema, prefixKeys, result, context, isDefault);
  }
}

function isArrayIndexKey(key: string): boolean {
  return /^\d+$/.test(key);
}

function appendResolvedArrayIndex(segments: string[], index: string): string[] {
  if (segments.length === 0) return [`[${index}]`];
  const next = [...segments];
  next[next.length - 1] = `${next[next.length - 1]}[${index}]`;
  return next;
}

function buildFieldPathLabel(
  schema: z.ZodTypeAny,
  fieldKeys: string[],
  segments: string[] = [],
  suppressNextObjectPropertyLabel = false,
): string | null {
  if (fieldKeys.length === 0) {
    return segments.filter(Boolean).join(".");
  }

  const currentKey = fieldKeys[0]!;
  const restKeys = fieldKeys.slice(1);
  const inner = unwrapWrappers(schema);

  if (inner instanceof z.ZodObject) {
    const fieldSchema = inner.shape[currentKey] as z.ZodTypeAny | undefined;
    if (!fieldSchema) return null;

    const meta = getUnwrappedMeta(fieldSchema);
    const fieldInner = unwrapWrappers(fieldSchema);
    const nextSegments =
      ((fieldInner instanceof z.ZodObject && suppressNextObjectPropertyLabel) ||
        fieldInner instanceof z.ZodUnion ||
        fieldInner instanceof z.ZodDiscriminatedUnion ||
        fieldInner instanceof z.ZodIntersection)
        ? segments
        : meta.label
          ? [...segments, meta.label]
          : segments;

    return buildFieldPathLabel(fieldSchema, restKeys, nextSegments);
  }

  if (inner instanceof z.ZodArray) {
    if (!isArrayIndexKey(currentKey)) return null;
    const elementSchema = (inner as unknown as { element: z.ZodTypeAny }).element;
    return buildFieldPathLabel(
      elementSchema,
      restKeys,
      appendResolvedArrayIndex(segments, currentKey),
    );
  }

  if (inner instanceof z.ZodRecord) {
    const valueSchema = getRecordValueSchema(inner);
    if (!valueSchema || !isValidRecordKey(currentKey)) return null;
    return buildFieldPathLabel(valueSchema, restKeys, [...segments, currentKey]);
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const discriminatorKey = (
      (inner as unknown as { _def: { discriminator?: string } })._def.discriminator ??
      (inner as unknown as { discriminator?: string }).discriminator ??
      ""
    );

    if (currentKey === discriminatorKey) {
      const unionMeta = getUnwrappedUnionMeta(schema);
      const nextSegments = [
        ...segments,
        (unionMeta?.selectorLabel as string | undefined) ?? discriminatorKey,
      ];
      return restKeys.length === 0
        ? nextSegments.filter(Boolean).join(".")
        : null;
    }

    for (const option of inner.options as z.ZodTypeAny[]) {
      const resolved = buildFieldPathLabel(
        option,
        fieldKeys,
        segments,
        true,
      );
      if (resolved) return resolved;
    }
    return null;
  }

  if (inner instanceof z.ZodUnion) {
    for (const option of inner.options as z.ZodTypeAny[]) {
      const resolved = buildFieldPathLabel(
        option,
        fieldKeys,
        segments,
        true,
      );
      if (resolved) return resolved;
    }
    return null;
  }

  if (inner instanceof z.ZodIntersection) {
    return (
      buildFieldPathLabel(
        inner._def.left as z.ZodTypeAny,
        fieldKeys,
        segments,
        suppressNextObjectPropertyLabel,
      ) ??
      buildFieldPathLabel(
        inner._def.right as z.ZodTypeAny,
        fieldKeys,
        segments,
        suppressNextObjectPropertyLabel,
      )
    );
  }

  return null;
}

function buildTemplatePathLabel(
  schema: z.ZodTypeAny,
  templateKeys: string[],
  segments: string[] = [],
  suppressNextObjectPropertyLabel = false,
): string | null {
  if (templateKeys.length === 0) {
    return segments.filter(Boolean).join(".");
  }

  const currentKey = templateKeys[0]!;
  const restKeys = templateKeys.slice(1);
  const inner = unwrapWrappers(schema);

  if (inner instanceof z.ZodObject) {
    const fieldSchema = inner.shape[currentKey] as z.ZodTypeAny | undefined;
    if (!fieldSchema) return null;

    const meta = getUnwrappedMeta(fieldSchema);
    const fieldInner = unwrapWrappers(fieldSchema);
    const nextSegments =
      ((fieldInner instanceof z.ZodObject && suppressNextObjectPropertyLabel) ||
        fieldInner instanceof z.ZodUnion ||
        fieldInner instanceof z.ZodDiscriminatedUnion ||
        fieldInner instanceof z.ZodIntersection)
        ? segments
        : meta.label
          ? [...segments, meta.label]
          : segments;

    return buildTemplatePathLabel(fieldSchema, restKeys, nextSegments);
  }

  if (inner instanceof z.ZodArray) {
    if (!isArrayIndexKey(currentKey)) return null;
    const elementSchema = (inner as unknown as { element: z.ZodTypeAny }).element;
    return buildTemplatePathLabel(
      elementSchema,
      restKeys,
      appendResolvedArrayIndex(segments, currentKey),
    );
  }

  if (inner instanceof z.ZodRecord) {
    const valueSchema = getRecordValueSchema(inner);
    if (!valueSchema || currentKey !== "*") return null;
    return buildTemplatePathLabel(valueSchema, restKeys, [...segments, "*"]);
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    for (const option of inner.options as z.ZodTypeAny[]) {
      const resolved = buildTemplatePathLabel(
        option,
        templateKeys,
        segments,
        true,
      );
      if (resolved) return resolved;
    }
    return null;
  }

  if (inner instanceof z.ZodUnion) {
    for (const option of inner.options as z.ZodTypeAny[]) {
      const resolved = buildTemplatePathLabel(
        option,
        templateKeys,
        segments,
        true,
      );
      if (resolved) return resolved;
    }
    return null;
  }

  if (inner instanceof z.ZodIntersection) {
    return (
      buildTemplatePathLabel(
        inner._def.left as z.ZodTypeAny,
        templateKeys,
        segments,
        suppressNextObjectPropertyLabel,
      ) ??
      buildTemplatePathLabel(
        inner._def.right as z.ZodTypeAny,
        templateKeys,
        segments,
        suppressNextObjectPropertyLabel,
      )
    );
  }

  return null;
}

export type ExtractSchemaColumnsOptions = {
  defaultFieldPaths?: string[];
  selectedFieldPaths?: string[];
};

export function extractSchemaColumns(
  schema: z.ZodTypeAny,
  options?: ExtractSchemaColumnsOptions,
): SchemaColumnDef[] {
  const context: CollectColumnsContext = {
    maxSelectedArrayIndexByPrefix: buildMaxSelectedArrayIndexByPrefix(
      options?.selectedFieldPaths,
    ),
    selectedChildKeysByPrefix: buildSelectedChildKeysByPrefix(
      options?.selectedFieldPaths,
    ),
  };
  const result = new Map<string, SchemaColumnDef>();
  collectColumns(schema, [], result, context);
  const columns = Array.from(result.values()).map((col) => ({
    ...col,
    label:
      buildFieldPathLabel(schema, col.fieldKeys) ??
      col.label ??
      col.fieldPath,
  }));

  if (options?.defaultFieldPaths) {
    const defaultSet = new Set(options.defaultFieldPaths);
    for (const col of columns) {
      col.isDefault = defaultSet.has(col.fieldPath);
    }
  }

  return columns;
}

export function extractSchemaRecordTemplates(
  schema: z.ZodTypeAny,
  options?: ExtractSchemaColumnsOptions,
): SchemaRecordTemplateDef[] {
  const context: CollectColumnsContext = {
    maxSelectedArrayIndexByPrefix: buildMaxSelectedArrayIndexByPrefix(
      options?.selectedFieldPaths,
    ),
    selectedChildKeysByPrefix: buildSelectedChildKeysByPrefix(
      options?.selectedFieldPaths,
    ),
  };
  const result = new Map<string, SchemaRecordTemplateDef>();
  collectRecordTemplates(schema, [], result, context);
  return Array.from(result.values()).map((template) => ({
    ...template,
    label:
      buildTemplatePathLabel(schema, template.templateKeys) ??
      template.label ??
      template.templatePath,
  }));
}
