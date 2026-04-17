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

function unwrapWrappers(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current.unwrap() as z.ZodTypeAny;
  }
  return current;
}

function getUnwrappedUnionMeta(schema: z.ZodTypeAny) {
  let current = schema;
  let meta = getMetaReact(current, "union");

  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current.unwrap() as z.ZodTypeAny;

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
    if (!meta.label) continue;

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
      collectFromArray(inner, fieldSchema, fieldKeys, key, result, isDefault);
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
    collectColumns(inner._def.left as z.ZodTypeAny, prefixKeys, result, isDefault);
    collectColumns(inner._def.right as z.ZodTypeAny, prefixKeys, result, isDefault);
    return;
  }

  if (inner instanceof z.ZodArray) {
    const currentKey =
      prefixKeys.length > 0 ? prefixKeys[prefixKeys.length - 1] ?? "" : "";
    collectFromArray(inner, schema, prefixKeys, currentKey, result, isDefault);
    return;
  }
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
  const columns = Array.from(result.values());

  if (options?.defaultFieldPaths) {
    const defaultSet = new Set(options.defaultFieldPaths);
    for (const col of columns) {
      col.isDefault = defaultSet.has(col.fieldPath);
    }
  }

  return columns;
}
