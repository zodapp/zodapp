import { getMetaReact } from "@zodapp/zod-form-react";
import { zf } from "@zodapp/zod-form";
import { z } from "zod";
import { getUnwrappedMeta } from "./table-types";

const DEFAULT_DISPLAY_LENGTH = 1;

export type SchemaColumnDef = {
  label: string;
  fieldPath: string;
  fieldKeys: string[];
  schema: z.ZodTypeAny;
  meta: ReturnType<typeof getUnwrappedMeta>;
  isDefault: boolean;
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

function collectFromArray(
  arraySchema: z.ZodTypeAny,
  originalFieldSchema: z.ZodTypeAny,
  prefixKeys: string[],
  fieldLabel: string,
  result: Map<string, SchemaColumnDef>,
  isDefault = true,
): void {
  const arrayMeta = getMetaReact(originalFieldSchema, "array");
  const displayLength: number =
    (arrayMeta?.displayLength as number | undefined) ?? DEFAULT_DISPLAY_LENGTH;
  const elementSchema = (arraySchema as unknown as { element: z.ZodTypeAny }).element;
  const elementInner = unwrapWrappers(elementSchema);

  for (let i = 0; i < displayLength; i++) {
    const indexKey = String(i);
    const elementKeys = [...prefixKeys, indexKey];

    if (elementInner instanceof z.ZodObject) {
      collectFromObject(elementInner, elementKeys, result, isDefault);
    } else if (
      elementInner instanceof z.ZodUnion ||
      elementInner instanceof z.ZodDiscriminatedUnion ||
      elementInner instanceof z.ZodIntersection
    ) {
      collectColumns(elementInner, elementKeys, result, isDefault);
    } else if (elementInner instanceof z.ZodArray) {
      collectFromArray(
        elementInner,
        elementSchema,
        elementKeys,
        fieldLabel,
        result,
        isDefault,
      );
    } else {
      const fieldPath = elementKeys.join(".");
      if (!result.has(fieldPath)) {
        const meta = getUnwrappedMeta(elementSchema);
        result.set(fieldPath, {
          label: `${meta.label ?? fieldLabel}[${i}]`,
          fieldPath,
          fieldKeys: elementKeys,
          schema: elementSchema,
          meta,
          isDefault,
        });
      }
    }
  }
}

function collectFromObject(
  schema: z.ZodObject<z.ZodRawShape>,
  prefixKeys: string[],
  result: Map<string, SchemaColumnDef>,
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
    const fieldPath = fieldKeys.join(".");
    const meta = getUnwrappedMeta(fieldSchema);
    const isDefault = parentIsDefault && (propertySet == null || propertySet.has(key));

    if (meta.hidden || meta.typeName === "hidden" || meta.tags?.includes("hidden")) continue;
    if (key.startsWith("__")) continue;
    if (meta.label == null) continue;

    const inner = unwrapWrappers(fieldSchema);

    if (inner instanceof z.ZodObject) {
      collectFromObject(inner, fieldKeys, result, isDefault);
    } else if (
      inner instanceof z.ZodUnion ||
      inner instanceof z.ZodDiscriminatedUnion ||
      inner instanceof z.ZodIntersection
    ) {
      collectColumns(fieldSchema, fieldKeys, result, isDefault);
    } else if (inner instanceof z.ZodArray) {
      collectFromArray(
        inner,
        fieldSchema,
        fieldKeys,
        meta.label,
        result,
        isDefault,
      );
    } else if (inner instanceof z.ZodRecord) {
      // record はテーブル列として抽出しない
    } else {
      if (!result.has(fieldPath)) {
        result.set(fieldPath, {
          label: meta.label ?? key,
          fieldPath,
          fieldKeys,
          schema: fieldSchema,
          meta,
          isDefault,
        });
      }
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
  isDefault = true,
): void {
  const inner = unwrapWrappers(schema);

  if (inner instanceof z.ZodObject) {
    collectFromObject(inner, prefixKeys, result, isDefault);
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
      collectColumns(option, prefixKeys, result, isDefault);
    }
    return;
  }

  if (inner instanceof z.ZodUnion) {
    const options = inner.options as z.ZodTypeAny[];
    for (const option of options) {
      collectColumns(option, prefixKeys, result, isDefault);
    }
    return;
  }

  if (inner instanceof z.ZodIntersection) {
    collectColumns(
      inner._def.left as z.ZodTypeAny,
      prefixKeys,
      result,
      isDefault,
    );
    collectColumns(
      inner._def.right as z.ZodTypeAny,
      prefixKeys,
      result,
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
      isDefault,
    );
    return;
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

export type ExtractSchemaColumnsOptions = {
  defaultFieldPaths?: string[];
};

export function extractSchemaColumns(
  schema: z.ZodTypeAny,
  options?: ExtractSchemaColumnsOptions,
): SchemaColumnDef[] {
  const result = new Map<string, SchemaColumnDef>();
  collectColumns(schema, [], result);
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
