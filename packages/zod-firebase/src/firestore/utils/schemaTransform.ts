import {
  cloneSchema,
  getMeta,
  type AnyZodObject,
  replaceDiscriminatedUnionOptions,
  replaceObjectShape,
  replaceIntersectionSides,
  replaceUnionOptions,
  unwrapSchema,
  zf,
} from "@zodapp/zod-form";
import { z } from "zod";

type MergeMode = "optional" | "required" | "asIs";

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const hiddenString = (optional = false) =>
  (optional ? z.string().optional() : z.string()).register(
    zf.hidden.registry,
    {},
  );

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

const materializeOptionalField = (schema?: z.ZodTypeAny): z.ZodTypeAny => {
  if (!schema) return hiddenString(true);
  if (schema instanceof z.ZodOptional) return cloneSchema(schema);

  const label = getMeta(schema as z.ZodTypeAny)?.label;
  const optional = cloneSchema(schema).optional();
  optional.register(zf.hidden.registry, {
    ...(label ? { label } : {}),
  });
  return optional;
};

const materializeField = (
  schema: z.ZodTypeAny | undefined,
  mode: MergeMode,
): z.ZodTypeAny => {
  if (mode === "optional") return materializeOptionalField(schema);
  if (mode === "required") return materializeRequiredField(schema);
  return schema ?? hiddenString();
};

const buildUnsupportedSchemaError = (contextLabel: string) =>
  new Error(
    `[collectionConfig] ${contextLabel} only supports ZodObject, ZodUnion, ` +
      `ZodDiscriminatedUnion, ZodIntersection, and their wrappers.`,
  );

export const mergeSchemaWithObject = (
  base: z.ZodTypeAny,
  delta: AnyZodObject,
  mode: MergeMode,
  contextLabel = "schema merge",
): z.ZodTypeAny => {
  if (isEmptyShape(delta.shape)) return base;

  const { inner, rewrap } = unwrapSchema(base);

  if (inner instanceof z.ZodObject) {
    const nextShape = Object.fromEntries(
      Object.entries(delta.shape).map(([key, schema]) => {
        const sourceSchema = inner.shape[key]
          ? (inner.shape[key] as z.ZodTypeAny)
          : (schema as z.ZodTypeAny);
        return [key, materializeField(sourceSchema, mode)];
      }),
    ) as z.ZodRawShape;
    const mergedShape = {
      ...inner.shape,
      ...nextShape,
    };
    return rewrap(
      replaceObjectShape(inner as AnyZodObject, mergedShape, {
        properties: Object.keys(mergedShape),
      }),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const nextOptions = Array.from(
      inner.options as readonly AnyZodObject[],
    ).map((option) =>
      mergeSchemaWithObject(
        option,
        delta,
        mode,
        contextLabel,
      ),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(
      inner.options as readonly z.ZodTypeAny[],
    ).map((option) =>
      mergeSchemaWithObject(
        option,
        delta,
        mode,
        contextLabel,
      ),
    ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];
    return rewrap(replaceUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = mergeSchemaWithObject(
      inner._def.left as z.ZodTypeAny,
      delta,
      mode,
      contextLabel,
    );
    const right = mergeSchemaWithObject(
      inner._def.right as z.ZodTypeAny,
      delta,
      mode,
      contextLabel,
    );
    return rewrap(replaceIntersectionSides(inner, left, right));
  }

  throw buildUnsupportedSchemaError(contextLabel);
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
