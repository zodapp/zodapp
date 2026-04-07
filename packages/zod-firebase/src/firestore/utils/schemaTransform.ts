import {
  cloneSchema,
  getMeta,
  type AnyZodObject,
  replaceDiscriminatedUnionOptions,
  replaceIntersectionSides,
  replaceObjectShape,
  replaceUnionOptions,
  unwrapSchema,
  zf,
} from "@zodapp/zod-form";
import { z } from "zod";

type MergeMode = "required" | "asIs";
type FieldManipulator = (schema: z.ZodTypeAny) => z.ZodTypeAny;

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const hiddenString = () => z.string().register(zf.hidden.registry, {});

const materializeRequiredField = (schema?: z.ZodTypeAny): z.ZodTypeAny => {
  if (!schema) return hiddenString();
  if (!(schema instanceof z.ZodOptional)) return cloneSchema(schema);

  const inner = schema.unwrap() as z.ZodTypeAny;
  const optionalMeta = getMeta(schema as z.ZodTypeAny);
  const isHidden =
    optionalMeta?.typeName === "hidden" || optionalMeta?.hidden;
  const cloned = cloneSchema(inner);
  if (isHidden) {
    cloned.register(zf.hidden.registry, {
      ...(optionalMeta?.label ? { label: optionalMeta.label } : {}),
    });
  }
  return cloned;
};

const buildUnsupportedSchemaError = (contextLabel: string) =>
  new Error(
    `[collectionConfig] ${contextLabel} only supports ZodObject, ZodUnion, ` +
      `ZodDiscriminatedUnion, ZodIntersection, and their wrappers.`,
  );

const identityField: FieldManipulator = (schema) => schema;

const getFieldManipulator = (mode: MergeMode): FieldManipulator => {
  if (mode === "required") return materializeRequiredField;
  return identityField;
};

const mergeTopLevelObjectShape = (
  base: AnyZodObject,
  delta: AnyZodObject,
  manipulateField: FieldManipulator,
): AnyZodObject => {
  const mergedShape: Record<string, z.ZodRawShape[string]> = { ...base.shape };

  for (const [key, extraSchema] of Object.entries(delta.shape)) {
    const sourceSchema =
      (base.shape[key] as z.ZodTypeAny | undefined) ?? (extraSchema as z.ZodTypeAny);
    mergedShape[key] = manipulateField(sourceSchema);
  }

  return replaceObjectShape(base, mergedShape as z.ZodRawShape);
};

const mergeCompositeTopLevelFields = (
  base: z.ZodTypeAny,
  delta: AnyZodObject,
  manipulateField: FieldManipulator,
  contextLabel: string,
): z.ZodTypeAny => {
  if (isEmptyShape(delta.shape)) return base;

  const { inner, rewrap } = unwrapSchema(base);

  if (inner instanceof z.ZodObject) {
    return rewrap(
      mergeTopLevelObjectShape(inner as AnyZodObject, delta, manipulateField),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const nextOptions = Array.from(
      inner.options as readonly AnyZodObject[],
    ).map((option) =>
      mergeCompositeTopLevelFields(option, delta, manipulateField, contextLabel),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(
      inner.options as readonly z.ZodTypeAny[],
    ).map((option) =>
      mergeCompositeTopLevelFields(option, delta, manipulateField, contextLabel),
    ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];
    return rewrap(replaceUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = mergeCompositeTopLevelFields(
      inner._def.left as z.ZodTypeAny,
      delta,
      manipulateField,
      contextLabel,
    );
    const right = mergeCompositeTopLevelFields(
      inner._def.right as z.ZodTypeAny,
      delta,
      manipulateField,
      contextLabel,
    );
    return rewrap(replaceIntersectionSides(inner, left, right));
  }

  throw buildUnsupportedSchemaError(contextLabel);
};

export const mergeSchemaWithObject = (
  base: z.ZodTypeAny,
  delta: AnyZodObject,
  mode: MergeMode,
  contextLabel = "schema merge",
): z.ZodTypeAny => {
  return mergeCompositeTopLevelFields(
    base,
    delta,
    getFieldManipulator(mode),
    contextLabel,
  );
};

/**
 * intrinsicSchema が top-level の ZodObject の場合のみ、
 * keys と重複するフィールドが optional であることを検証する。
 */
export const assertTopLevelOverlappingKeysOptional = (
  schema: z.ZodTypeAny,
  keys: readonly string[],
  contextLabel: string,
): void => {
  if (keys.length === 0) return;

  const { inner } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    const shape = inner.shape as Record<string, z.ZodTypeAny>;
    for (const key of keys) {
      const field = shape[key];
      if (!field) continue;
      if (!(field instanceof z.ZodOptional)) {
        throw new Error(
          `[collectionConfig] ${contextLabel}: intrinsic schema field "${key}" ` +
            `must be optional when it overlaps with identity or createExcluded keys. ` +
            `Use .optional() to allow the overlap.`,
        );
      }
    }
  }
};
