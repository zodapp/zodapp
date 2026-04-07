import {
  type AnyZodObject,
  replaceDiscriminatedUnionOptions,
  replaceIntersectionSides,
  replaceObjectShape,
  replaceUnionOptions,
  unwrapSchema,
} from "@zodapp/zod-form";
import { z } from "zod";

type EmptyShape = Record<never, never>;

type ShapeInput<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.input<Shape[K]>;
};

type ShapeOutput<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.output<Shape[K]>;
};

export type ExtendMode = "head" | "tail" | "append" | "prepend";

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

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const modePlacesNewKeysFirst = (mode: ExtendMode) =>
  mode === "head" || mode === "prepend";

const buildOrderedKeys = (
  shape: z.ZodRawShape,
  extra: z.ZodRawShape,
  mode: ExtendMode,
): string[] => {
  const currentKeys = Object.keys(shape);
  const extraKeys = Object.keys(extra);
  const currentKeySet = new Set(currentKeys);
  const extraKeySet = new Set(extraKeys);
  const newKeys = extraKeys.filter((key) => !currentKeySet.has(key));

  if (mode === "append") {
    return [...currentKeys, ...newKeys];
  }

  if (mode === "prepend") {
    return [...newKeys, ...currentKeys];
  }

  const restKeys = currentKeys.filter((key) => !extraKeySet.has(key));
  return mode === "head" ? [...extraKeys, ...restKeys] : [...restKeys, ...extraKeys];
};

const rebuildObjectShape = (
  shape: z.ZodRawShape,
  extra: z.ZodRawShape,
  mode: ExtendMode,
): z.ZodRawShape => {
  const orderedKeys = buildOrderedKeys(shape, extra, mode);
  return Object.fromEntries(
    orderedKeys.map((key) => [key, (extra[key] ?? shape[key]) as z.ZodTypeAny]),
  ) as z.ZodRawShape;
};

const rebuildObjectSchema = (
  schema: AnyZodObject,
  extra: z.ZodRawShape,
  mode: ExtendMode,
): AnyZodObject => {
  return replaceObjectShape(schema, rebuildObjectShape(schema.shape, extra, mode));
};

const collectTopLevelKeys = (schema: z.ZodTypeAny): Set<string> => {
  const { inner } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    return new Set(Object.keys(inner.shape));
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    return Array.from(inner.options as readonly AnyZodObject[]).reduce(
      (keys, option) => new Set([...keys, ...collectTopLevelKeys(option)]),
      new Set<string>(),
    );
  }

  if (inner instanceof z.ZodUnion) {
    return Array.from(inner.options as readonly z.ZodTypeAny[]).reduce(
      (keys, option) => new Set([...keys, ...collectTopLevelKeys(option)]),
      new Set<string>(),
    );
  }

  if (inner instanceof z.ZodIntersection) {
    return new Set([
      ...collectTopLevelKeys(inner._def.left as z.ZodTypeAny),
      ...collectTopLevelKeys(inner._def.right as z.ZodTypeAny),
    ]);
  }

  return new Set<string>();
};

const splitIntersectionShape = (
  left: z.ZodTypeAny,
  right: z.ZodTypeAny,
  extra: z.ZodRawShape,
  mode: ExtendMode,
): {
  leftExtra: z.ZodRawShape;
  rightExtra: z.ZodRawShape;
} => {
  const leftKeys = collectTopLevelKeys(left);
  const rightKeys = collectTopLevelKeys(right);
  const leftExtra: Record<string, z.ZodRawShape[string]> = {};
  const rightExtra: Record<string, z.ZodRawShape[string]> = {};
  const targetForNewKeys = modePlacesNewKeysFirst(mode) ? leftExtra : rightExtra;

  for (const [key, schema] of Object.entries(extra)) {
    const inLeft = leftKeys.has(key);
    const inRight = rightKeys.has(key);

    if (inLeft) leftExtra[key] = schema;
    if (inRight) rightExtra[key] = schema;
    if (!inLeft && !inRight) targetForNewKeys[key] = schema;
  }

  return {
    leftExtra: leftExtra as z.ZodRawShape,
    rightExtra: rightExtra as z.ZodRawShape,
  };
};

const applyShape = (
  schema: z.ZodTypeAny,
  extra: z.ZodRawShape,
  mode: ExtendMode,
): z.ZodTypeAny => {
  if (isEmptyShape(extra)) return schema;

  const { inner, rewrap } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    return rewrap(rebuildObjectSchema(inner as AnyZodObject, extra, mode));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = inner._def.left as z.ZodTypeAny;
    const right = inner._def.right as z.ZodTypeAny;
    const { leftExtra, rightExtra } = splitIntersectionShape(left, right, extra, mode);

    return rewrap(
      replaceIntersectionSides(
        inner,
        applyShape(left, leftExtra, mode),
        applyShape(right, rightExtra, mode),
      ),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(inner.options as readonly AnyZodObject[]).map(
      (option) => applyShape(option, extra, mode),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, options));
  }

  if (inner instanceof z.ZodUnion) {
    const options = Array.from(inner.options as readonly z.ZodTypeAny[]).map(
      (option) => applyShape(option, extra, mode),
    );
    return rewrap(
      replaceUnionOptions(
        inner,
        options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      ),
    );
  }

  return schema;
};

const collectArmKeySets = (schema: z.ZodTypeAny): Array<Set<string>> => {
  const { inner } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    return [new Set(Object.keys(inner.shape))];
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    return Array.from(inner.options as readonly AnyZodObject[]).flatMap((option) =>
      collectArmKeySets(option),
    );
  }

  if (inner instanceof z.ZodUnion) {
    return Array.from(inner.options as readonly z.ZodTypeAny[]).flatMap((option) =>
      collectArmKeySets(option),
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
  if (isEmptyShape(extra)) return;

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
  const next = applyShape(schema, extra, mode);
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
