import { getMeta, zf } from "../def";
import { z } from "zod";

export type AnyZodObject = z.ZodObject<z.ZodRawShape>;

type Wrapper =
  | { kind: "optional" }
  | { kind: "nullable" }
  | { kind: "default"; defaultValue: unknown };

type RewrapOptions = {
  preserveOptional?: boolean;
};

type ReplaceObjectShapeOptions = {
  properties?: readonly string[];
};

/**
 * Zod スキーマを公開 API のみで clone します。
 */
export function cloneSchema<T extends z.ZodTypeAny>(schema: T): T {
  return schema.clone({
    ...schema.def,
  });
}

export const unwrapSchema = (schema: z.ZodTypeAny) => {
  const wrappers: Wrapper[] = [];
  let current = schema;

  while (true) {
    if (current instanceof z.ZodOptional) {
      wrappers.push({ kind: "optional" });
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }
    if (current instanceof z.ZodNullable) {
      wrappers.push({ kind: "nullable" });
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }
    if (current instanceof z.ZodDefault) {
      wrappers.push({
        kind: "default",
        defaultValue: (current._def as { defaultValue: unknown }).defaultValue,
      });
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }
    break;
  }

  const rewrap = (
    next: z.ZodTypeAny,
    options: RewrapOptions = {},
  ): z.ZodTypeAny =>
    wrappers.reduceRight<z.ZodTypeAny>((acc, wrapper) => {
      if (wrapper.kind === "optional") {
        return options.preserveOptional === false ? acc : acc.optional();
      }
      if (wrapper.kind === "nullable") return acc.nullable();
      return acc.default(wrapper.defaultValue as never);
    }, next);

  return { inner: current, rewrap };
};

export const replaceObjectShape = (
  schema: AnyZodObject,
  nextShape: z.ZodRawShape,
  options: ReplaceObjectShapeOptions = {},
): AnyZodObject => {
  let nextObject = schema.clone({
    ...schema.def,
    shape: nextShape,
  });

  const objectMeta = getMeta(schema, "object");
  if (objectMeta) {
    nextObject = nextObject.register(
      zf.object.registry as never,
      {
        ...(objectMeta as Record<string, unknown>),
        ...(options.properties ? { properties: [...options.properties] } : {}),
      } as never,
    );
  }

  return nextObject as AnyZodObject;
};

export const replaceArrayElement = (
  schema: z.ZodArray<z.core.SomeType>,
  nextElement: z.ZodTypeAny,
): z.ZodTypeAny => {
  return schema.clone({
    ...schema.def,
    element: nextElement,
  });
};

export const replaceUnionOptions = (
  schema: z.ZodUnion<readonly z.core.SomeType[]>,
  nextOptions: readonly [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
): z.ZodTypeAny => {
  return schema.clone({
    ...schema.def,
    options: nextOptions,
  });
};

export const replaceDiscriminatedUnionOptions = (
  schema: z.ZodDiscriminatedUnion<readonly z.core.SomeType[], string>,
  nextOptions: readonly [AnyZodObject, AnyZodObject, ...AnyZodObject[]],
): z.ZodTypeAny => {
  return schema.clone({
    ...schema.def,
    options: nextOptions,
  });
};

export const replaceIntersectionSides = (
  schema: z.ZodIntersection<z.core.SomeType, z.core.SomeType>,
  left: z.ZodTypeAny,
  right: z.ZodTypeAny,
): z.ZodTypeAny => {
  return schema.clone({
    ...schema.def,
    left,
    right,
  });
};

// ---------------------------------------------------------------------------
// Top-level composite schema transform
// ---------------------------------------------------------------------------

export type TransformMode = "head" | "tail" | "append" | "prepend";

type FieldReducer = (
  existent: z.ZodTypeAny | undefined,
  replacement: z.ZodTypeAny,
  key: string,
) => z.ZodTypeAny;

export type TransformCompositeOptions = {
  mode: TransformMode;
  reduceField: FieldReducer;
};

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const modePlacesNewKeysFirst = (mode: TransformMode) =>
  mode === "head" || mode === "prepend";

const buildOrderedKeys = (
  shape: z.ZodRawShape,
  extra: z.ZodRawShape,
  mode: TransformMode,
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
  return mode === "head"
    ? [...extraKeys, ...restKeys]
    : [...restKeys, ...extraKeys];
};

const buildObjectShape = (
  shape: z.ZodRawShape,
  extra: z.ZodRawShape,
  mode: TransformMode,
  reduceField: FieldReducer,
): z.ZodRawShape => {
  const orderedKeys = buildOrderedKeys(shape, extra, mode);
  return Object.fromEntries(
    orderedKeys.map((key) => {
      const existent = shape[key] as z.ZodTypeAny | undefined;
      const replacement = extra[key] as z.ZodTypeAny | undefined;
      if (replacement !== undefined) {
        return [key, reduceField(existent, replacement, key)];
      }
      return [key, existent as z.ZodTypeAny];
    }),
  ) as z.ZodRawShape;
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

const splitIntersectionExtra = (
  left: z.ZodTypeAny,
  right: z.ZodTypeAny,
  extra: z.ZodRawShape,
  mode: TransformMode,
): { leftExtra: z.ZodRawShape; rightExtra: z.ZodRawShape } => {
  const leftKeys = collectTopLevelKeys(left);
  const rightKeys = collectTopLevelKeys(right);
  const leftExtra: Record<string, z.ZodRawShape[string]> = {};
  const rightExtra: Record<string, z.ZodRawShape[string]> = {};
  const targetForNewKeys = modePlacesNewKeysFirst(mode)
    ? leftExtra
    : rightExtra;

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

export const transformCompositeTopLevel = (
  schema: z.ZodTypeAny,
  extra: z.ZodRawShape,
  options: TransformCompositeOptions,
): z.ZodTypeAny => {
  if (isEmptyShape(extra)) return schema;

  const { mode, reduceField } = options;
  const { inner, rewrap } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    const nextShape = buildObjectShape(
      inner.shape,
      extra,
      mode,
      reduceField,
    );
    return rewrap(replaceObjectShape(inner as AnyZodObject, nextShape));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = inner._def.left as z.ZodTypeAny;
    const right = inner._def.right as z.ZodTypeAny;
    const { leftExtra, rightExtra } = splitIntersectionExtra(
      left,
      right,
      extra,
      mode,
    );

    return rewrap(
      replaceIntersectionSides(
        inner,
        transformCompositeTopLevel(left, leftExtra, options),
        transformCompositeTopLevel(right, rightExtra, options),
      ),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const nextOptions = Array.from(
      inner.options as readonly AnyZodObject[],
    ).map((option) =>
      transformCompositeTopLevel(option, extra, options),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(
      inner.options as readonly z.ZodTypeAny[],
    ).map((option) => transformCompositeTopLevel(option, extra, options));
    return rewrap(
      replaceUnionOptions(
        inner,
        nextOptions as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      ),
    );
  }

  return schema;
};
