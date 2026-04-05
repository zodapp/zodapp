import { getMeta, zf } from "@zodapp/zod-form";
import { z } from "zod";

type EmptyShape = Record<never, never>;

type ShapeInput<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.input<Shape[K]>;
};

type ShapeOutput<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.output<Shape[K]>;
};

export type ExtendSchemaOptions<
  Before extends z.ZodRawShape = EmptyShape,
  After extends z.ZodRawShape = EmptyShape,
> = {
  before?: Before;
  after?: After;
};

type ExtendSchemaOutput<
  S extends z.ZodTypeAny,
  Before extends z.ZodRawShape,
  After extends z.ZodRawShape,
> = z.output<S> & ShapeOutput<Before> & ShapeOutput<After>;

type ExtendSchemaInput<
  S extends z.ZodTypeAny,
  Before extends z.ZodRawShape,
  After extends z.ZodRawShape,
> = z.input<S> & ShapeInput<Before> & ShapeInput<After>;

export type Position = "before" | "after";

type ObjectMeta = {
  label?: string;
  uiType?: string;
  tags?: string[];
  hidden?: boolean;
  readOnly?: boolean;
  color?: string;
  width?: number;
  align?: "left" | "center" | "right";
  properties?: string[];
};

type Wrapper =
  | { kind: "optional" }
  | { kind: "nullable" }
  | { kind: "default"; defaultValue: unknown };

const EMPTY_SHAPE: EmptyShape = {};

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const omitShapeKeys = (
  shape: z.ZodRawShape,
  keys: string[],
): z.ZodRawShape => {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(shape).filter(([key]) => !keySet.has(key)),
  ) as z.ZodRawShape;
};

const mergeShape = (
  shape: z.ZodRawShape,
  extra: z.ZodRawShape,
  position: Position,
): z.ZodRawShape => {
  if (isEmptyShape(extra)) return shape;
  const rest = omitShapeKeys(shape, Object.keys(extra));
  return position === "before"
    ? { ...extra, ...rest }
    : { ...rest, ...extra };
};

const normalizeObjectOrder = (
  schema: z.ZodObject<z.ZodRawShape>,
  nextKeys: string[],
): string[] => {
  const objectMeta = getMeta(schema, "object") as ObjectMeta | undefined;
  const propertySet = new Set(nextKeys);
  const metaProperties = (objectMeta?.properties ?? []).filter((key) =>
    propertySet.has(key),
  );
  return [
    ...metaProperties,
    ...nextKeys.filter((key) => !metaProperties.includes(key)),
  ];
};

const mergeProperties = (
  schema: z.ZodObject<z.ZodRawShape>,
  nextShape: z.ZodRawShape,
  movedKeys: string[],
  position: Position,
): string[] => {
  const nextKeys = Object.keys(nextShape);
  const baseOrder = normalizeObjectOrder(schema, nextKeys);
  const moved = movedKeys.filter((key) => nextKeys.includes(key));
  const rest = baseOrder.filter((key) => !moved.includes(key));
  return position === "before" ? [...moved, ...rest] : [...rest, ...moved];
};

const rebuildObjectSchema = (
  schema: z.ZodObject<z.ZodRawShape>,
  extra: z.ZodRawShape,
  position: Position,
): z.ZodObject<z.ZodRawShape> => {
  const nextShape = mergeShape(schema.shape, extra, position);
  const nextObject = z.object(nextShape);
  const nextProperties = mergeProperties(
    schema,
    nextShape,
    Object.keys(extra),
    position,
  );
  const objectMeta = getMeta(schema, "object") as ObjectMeta | undefined;
  const nextMeta = { ...(objectMeta ?? {}), properties: nextProperties };
  return nextObject.register(zf.object.registry, nextMeta);
};

const unwrapSchema = (schema: z.ZodTypeAny) => {
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
        defaultValue: (
          current._def as { defaultValue: unknown }
        ).defaultValue,
      });
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }
    break;
  }

  const rewrap = (next: z.ZodTypeAny) =>
    wrappers.reduceRight<z.ZodTypeAny>((acc, wrapper) => {
      if (wrapper.kind === "optional") return acc.optional();
      if (wrapper.kind === "nullable") return acc.nullable();
      return acc.default(wrapper.defaultValue as never);
    }, next);

  return { inner: current, rewrap };
};

const applyShape = (
  schema: z.ZodTypeAny,
  extra: z.ZodRawShape,
  position: Position,
): z.ZodTypeAny => {
  if (isEmptyShape(extra)) return schema;

  const { inner, rewrap } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    return rewrap(rebuildObjectSchema(inner, extra, position));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = inner._def.left as z.ZodTypeAny;
    const right = inner._def.right as z.ZodTypeAny;
    const next =
      position === "before"
        ? z.intersection(applyShape(left, extra, position), right)
        : z.intersection(left, applyShape(right, extra, position));
    return rewrap(next);
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const discriminator = (
      inner as unknown as { _def: { discriminator: string } }
    )._def.discriminator;
    const options = Array.from(
      inner.options as readonly z.ZodObject<z.ZodRawShape>[],
    ).map((option) => applyShape(option, extra, position));
    const next = z.discriminatedUnion(
      discriminator,
      options as unknown as [
        z.ZodObject<z.ZodRawShape>,
        z.ZodObject<z.ZodRawShape>,
        ...z.ZodObject<z.ZodRawShape>[],
      ],
    );
    return rewrap(next);
  }

  if (inner instanceof z.ZodUnion) {
    const options = Array.from(inner.options as readonly z.ZodTypeAny[]).map(
      (option) => applyShape(option, extra, position),
    );
    const next = z.union(
      options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
    );
    return rewrap(next);
  }

  return schema;
};

const collectArmKeySets = (schema: z.ZodTypeAny): Array<Set<string>> => {
  const { inner } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    return [new Set(Object.keys(inner.shape))];
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    return Array.from(
      inner.options as readonly z.ZodObject<z.ZodRawShape>[],
    ).flatMap((option) => collectArmKeySets(option));
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
  position: Position,
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
        `extendSchemaSafe: ${position} に未知の key が含まれています`,
        `arm=${index + 1}`,
        `unknown=${unknownKeys.join(",")}`,
      ].join(" "),
    );
  }
};

export function extendSchema<
  S extends z.ZodTypeAny,
  Before extends z.ZodRawShape = EmptyShape,
  After extends z.ZodRawShape = EmptyShape,
>(
  schema: S,
  options: ExtendSchemaOptions<Before, After> = {},
): z.ZodType<
  ExtendSchemaOutput<S, Before, After>,
  ExtendSchemaInput<S, Before, After>
> {
  const before = (options.before ?? EMPTY_SHAPE) as Before;
  const after = (options.after ?? EMPTY_SHAPE) as After;
  const next = applyShape(applyShape(schema, before, "before"), after, "after");
  return next as unknown as z.ZodType<
    ExtendSchemaOutput<S, Before, After>,
    ExtendSchemaInput<S, Before, After>
  >;
}

export function extendSchemaSafe<
  S extends z.ZodTypeAny,
  Before extends z.ZodRawShape = EmptyShape,
  After extends z.ZodRawShape = EmptyShape,
>(
  schema: S,
  options: ExtendSchemaOptions<Before, After> = {},
): z.ZodType<z.output<S>, z.input<S>> {
  const before = (options.before ?? EMPTY_SHAPE) as Before;
  const after = (options.after ?? EMPTY_SHAPE) as After;

  assertNoNewKeys(schema, before, "before");
  assertNoNewKeys(schema, after, "after");

  return extendSchema(schema, options) as unknown as z.ZodType<
    z.output<S>,
    z.input<S>
  >;
}
