import { z } from "zod";
import { unwrapSchema } from "./schema";
import type { AnyZodObject } from "./schema";
import { mergeSchema } from "./schema";
import type { TransformMode } from "./schema";

type EmptyShape = Record<never, never>;

type ShapeInput<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.input<Shape[K]>;
};

type ShapeOutput<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.output<Shape[K]>;
};

export type ExtendMode = TransformMode;

export type ExtendSchemaOptions = {
  mode?: ExtendMode;
};

type ExtendSchemaOutput<
  S extends z.ZodTypeAny,
  Extra extends z.ZodRawShape,
> = z.output<S> & ShapeOutput<Extra>;

type ExtendSchemaInput<
  S extends z.ZodTypeAny,
  Extra extends z.ZodRawShape,
> = z.input<S> & ShapeInput<Extra>;

const EMPTY_SHAPE: EmptyShape = {};

const replaceFieldReducer = (
  _existent: z.ZodTypeAny | undefined,
  replacement: z.ZodTypeAny,
) => replacement;

const collectArmKeySets = (schema: z.ZodTypeAny): Array<Set<string>> => {
  const { inner } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    return [new Set(Object.keys(inner.shape))];
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    return Array.from(inner.options as readonly AnyZodObject[]).flatMap(
      (option) => collectArmKeySets(option),
    );
  }

  if (inner instanceof z.ZodUnion) {
    return Array.from(inner.options as readonly z.ZodTypeAny[]).flatMap(
      (option) => collectArmKeySets(option),
    );
  }

  if (inner instanceof z.ZodIntersection) {
    const left = collectArmKeySets(inner._def.left as z.ZodTypeAny);
    const right = collectArmKeySets(inner._def.right as z.ZodTypeAny);
    return left.flatMap((leftKeys) =>
      right.map((rightKeys) => new Set([...leftKeys, ...rightKeys])),
    );
  }

  return [new Set<string>()];
};

const isNeverBased = (schema: z.ZodRawShape[string] | undefined): boolean => {
  if (!schema) return false;
  const { inner } = unwrapSchema(schema as z.ZodTypeAny);
  return inner instanceof z.ZodNever;
};

const assertNoNewKeys = (
  schema: z.ZodTypeAny,
  extra: z.ZodRawShape,
  mode: ExtendMode,
): void => {
  if (Object.keys(extra).length === 0) return;

  const extraKeys = Object.keys(extra);
  const armKeySets = collectArmKeySets(schema);

  for (const [index, armKeys] of armKeySets.entries()) {
    const unknownKeys = extraKeys.filter(
      (key) => !armKeys.has(key) && !isNeverBased(extra[key]),
    );
    if (unknownKeys.length === 0) continue;

    throw new Error(
      [
        `extendSchemaSafe: ${mode} に未知の key が含まれています`,
        `arm=${index + 1}`,
        `unknown=${unknownKeys.join(",")}`,
      ].join(" "),
    );
  }
};

export function extendSchema<
  S extends z.ZodTypeAny,
  Extra extends z.ZodRawShape = EmptyShape,
>(
  schema: S,
  extra = EMPTY_SHAPE as Extra,
  options: ExtendSchemaOptions = {},
): z.ZodType<
  ExtendSchemaOutput<S, Extra>,
  ExtendSchemaInput<S, Extra>
> {
  const mode = options.mode ?? "tail";
  const next = mergeSchema(schema, extra, {
    mode,
    reduceField: replaceFieldReducer,
  });
  return next as unknown as z.ZodType<
    ExtendSchemaOutput<S, Extra>,
    ExtendSchemaInput<S, Extra>
  >;
}

export function extendSchemaSafe<
  S extends z.ZodTypeAny,
  Extra extends z.ZodRawShape = EmptyShape,
>(
  schema: S,
  extra = EMPTY_SHAPE as Extra,
  options: ExtendSchemaOptions = {},
): S {
  const mode = options.mode ?? "tail";

  assertNoNewKeys(schema, extra, mode);

  return extendSchema(schema, extra, options) as unknown as S;
}
