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

type MergeMode = "appendOptional" | "appendRequired" | "appendAsIs";

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const omitShapeKeys = (
  shape: z.ZodRawShape,
  keys: readonly string[],
): z.ZodRawShape => {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(shape).filter(([key]) => !keySet.has(key)),
  ) as z.ZodRawShape;
};

const hiddenString = (optional = false) =>
  (optional ? z.string().optional() : z.string()).register(
    zf.hidden.registry,
    {},
  );

const materializeRequiredField = (schema?: z.ZodTypeAny): z.ZodTypeAny => {
  if (!schema) return hiddenString();
  if (!(schema instanceof z.ZodOptional)) return schema;

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
  if (schema instanceof z.ZodOptional) return schema;

  const label = getMeta(schema as z.ZodTypeAny)?.label;
  const optional = schema.optional();
  optional.register(zf.hidden.registry, {
    ...(label ? { label } : {}),
  });
  return optional;
};

const buildUnsupportedSchemaError = (contextLabel: string) =>
  new Error(
    `[collectionConfig] ${contextLabel} only supports ZodObject, ZodUnion, ` +
      `ZodDiscriminatedUnion, ZodIntersection, and their wrappers.`,
  );

export const mergeSchemaRecursively = (
  base: z.ZodTypeAny,
  delta: AnyZodObject,
  mode: MergeMode,
  contextLabel: string,
  preferExistingOnOverlap = false,
): z.ZodTypeAny => {
  if (isEmptyShape(delta.shape)) return base;

  const { inner, rewrap } = unwrapSchema(base);

  if (inner instanceof z.ZodObject) {
    const nextShape = Object.fromEntries(
      Object.entries(delta.shape).map(([key, schema]) => {
        const sourceSchema =
          preferExistingOnOverlap && inner.shape[key]
            ? (inner.shape[key] as z.ZodTypeAny)
            : (schema as z.ZodTypeAny);
        return [
          key,
          mode === "appendOptional"
            ? materializeOptionalField(sourceSchema)
            : mode === "appendRequired"
              ? materializeRequiredField(sourceSchema)
              : sourceSchema,
        ];
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
      mergeSchemaRecursively(
        option,
        delta,
        mode,
        contextLabel,
        preferExistingOnOverlap,
      ),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(
      inner.options as readonly z.ZodTypeAny[],
    ).map((option) =>
      mergeSchemaRecursively(
        option,
        delta,
        mode,
        contextLabel,
        preferExistingOnOverlap,
      ),
    ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];
    return rewrap(replaceUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = mergeSchemaRecursively(
      inner._def.left as z.ZodTypeAny,
      delta,
      mode,
      contextLabel,
      preferExistingOnOverlap,
    );
    const right = mergeSchemaRecursively(
      inner._def.right as z.ZodTypeAny,
      delta,
      mode,
      contextLabel,
      preferExistingOnOverlap,
    );
    return rewrap(replaceIntersectionSides(inner, left, right));
  }

  throw buildUnsupportedSchemaError(contextLabel);
};

export const stripKeysRecursively = (
  schema: z.ZodTypeAny,
  keys: readonly string[],
  contextLabel: string,
): z.ZodTypeAny => {
  if (keys.length === 0) return schema;

  const { inner, rewrap } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    const nextShape = omitShapeKeys(inner.shape, keys);
    return rewrap(
      replaceObjectShape(inner as AnyZodObject, nextShape, {
        properties: Object.keys(nextShape),
      }),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const nextOptions = Array.from(
      inner.options as readonly AnyZodObject[],
    ).map((option) =>
      stripKeysRecursively(option, keys, contextLabel),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(
      inner.options as readonly z.ZodTypeAny[],
    ).map((option) => stripKeysRecursively(option, keys, contextLabel)) as [
      z.ZodTypeAny,
      z.ZodTypeAny,
      ...z.ZodTypeAny[],
    ];
    return rewrap(replaceUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = stripKeysRecursively(
      inner._def.left as z.ZodTypeAny,
      keys,
      contextLabel,
    );
    const right = stripKeysRecursively(
      inner._def.right as z.ZodTypeAny,
      keys,
      contextLabel,
    );
    return rewrap(replaceIntersectionSides(inner, left, right));
  }

  throw buildUnsupportedSchemaError(contextLabel);
};
