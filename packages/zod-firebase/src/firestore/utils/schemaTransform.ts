import {
  cloneSchema,
  getMeta,
  type AnyZodObject,
  mergeSchema,
  unwrapSchema,
  zf,
} from "@zodapp/zod-form";
import { z } from "zod";

type MergeMode = "required" | "asIs";

const hiddenString = () => z.string().register(zf.hidden.registry, {});

const materializeRequiredField = (schema?: z.ZodTypeAny): z.ZodTypeAny => {
  if (!schema) return hiddenString();
  if (!(schema instanceof z.ZodOptional)) return cloneSchema(schema);

  const inner = schema.unwrap() as z.ZodTypeAny;
  const optionalMeta = getMeta(schema as z.ZodTypeAny);
  const isHidden = optionalMeta?.typeName === "hidden" || optionalMeta?.hidden;
  const cloned = cloneSchema(inner);
  if (isHidden) {
    cloned.register(zf.hidden.registry, {
      ...(optionalMeta?.label ? { label: optionalMeta.label } : {}),
    });
  }
  return cloned;
};

export const mergeSchemaForCollection = (
  base: z.ZodTypeAny,
  delta: AnyZodObject,
  mode: MergeMode,
  _contextLabel = "schema merge",
): z.ZodTypeAny => {
  return mergeSchema(base, delta.shape, {
    mode: "append",
    reduceField: (existent, replacement, _key) => {
      const source = existent ?? replacement;
      if (mode === "required") return materializeRequiredField(source);
      return source;
    },
  });
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
