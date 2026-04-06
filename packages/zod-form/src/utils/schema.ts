import { getMeta, zf } from '../def';
import { z } from 'zod';

export type AnyZodObject = z.ZodObject<z.ZodRawShape>;

type Wrapper =
  | { kind: 'optional' }
  | { kind: 'nullable' }
  | { kind: 'default'; defaultValue: unknown };

type RewrapOptions = {
  preserveOptional?: boolean;
};

type ReplaceObjectShapeOptions = {
  properties?: readonly string[];
};

/**
 * Zod スキーマを公開 API のみで clone します。
 * `.describe()` が常に新しいインスタンスを返す性質を利用します。
 */
export function cloneSchema<T extends z.ZodTypeAny>(schema: T): T {
  return schema.describe(schema.description as string);
}

export const unwrapSchema = (schema: z.ZodTypeAny) => {
  const wrappers: Wrapper[] = [];
  let current = schema;

  while (true) {
    if (current instanceof z.ZodOptional) {
      wrappers.push({ kind: 'optional' });
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }
    if (current instanceof z.ZodNullable) {
      wrappers.push({ kind: 'nullable' });
      current = current.unwrap() as z.ZodTypeAny;
      continue;
    }
    if (current instanceof z.ZodDefault) {
      wrappers.push({
        kind: 'default',
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
      if (wrapper.kind === 'optional') {
        return options.preserveOptional === false ? acc : acc.optional();
      }
      if (wrapper.kind === 'nullable') return acc.nullable();
      return acc.default(wrapper.defaultValue as never);
    }, next);

  return { inner: current, rewrap };
};

export const replaceObjectShape = (
  schema: AnyZodObject,
  nextShape: z.ZodRawShape,
  options: ReplaceObjectShapeOptions = {},
): AnyZodObject => {
  let nextObject = z.object(nextShape);
  if (schema.description !== undefined) {
    nextObject = nextObject.describe(schema.description);
  }

  const objectMeta = getMeta(schema, 'object');
  if (objectMeta) {
    nextObject = nextObject.register(zf.object.registry as never, {
      ...(objectMeta as Record<string, unknown>),
      ...(options.properties ? { properties: [...options.properties] } : {}),
    } as never);
  }

  return nextObject as AnyZodObject;
};

export const replaceArrayElement = (
  schema: z.ZodTypeAny,
  nextElement: z.ZodTypeAny,
): z.ZodTypeAny => {
  let nextArray = z.array(nextElement);
  if (schema.description !== undefined) {
    nextArray = nextArray.describe(schema.description);
  }

  const arrayMeta = getMeta(schema, 'array');
  if (arrayMeta) {
    nextArray = nextArray.register(
      zf.array.registry as never,
      arrayMeta as never,
    );
  }

  return nextArray;
};

export const replaceUnionOptions = (
  schema: z.ZodTypeAny,
  nextOptions: [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
): z.ZodTypeAny => {
  let nextUnion = z.union(nextOptions);
  if (schema.description !== undefined) {
    nextUnion = nextUnion.describe(schema.description);
  }

  const unionMeta = getMeta(schema, 'union');
  if (unionMeta) {
    nextUnion = nextUnion.register(
      zf.union.registry as never,
      unionMeta as never,
    );
  }

  return nextUnion;
};

export const replaceDiscriminatedUnionOptions = (
  schema: z.ZodTypeAny,
  nextOptions: [AnyZodObject, AnyZodObject, ...AnyZodObject[]],
): z.ZodTypeAny => {
  const discriminator = (
    schema as unknown as { _def: { discriminator: string } }
  )._def.discriminator;

  let nextUnion = z.discriminatedUnion(discriminator, nextOptions);
  if (schema.description !== undefined) {
    nextUnion = nextUnion.describe(schema.description);
  }

  const unionMeta = getMeta(schema, 'union');
  if (unionMeta) {
    nextUnion = nextUnion.register(
      zf.union.registry as never,
      unionMeta as never,
    );
  }

  return nextUnion;
};

export const replaceIntersectionSides = (
  schema: z.ZodTypeAny,
  left: z.ZodTypeAny,
  right: z.ZodTypeAny,
): z.ZodTypeAny => {
  let nextIntersection = z.intersection(left, right);
  if (schema.description !== undefined) {
    nextIntersection = nextIntersection.describe(schema.description);
  }
  return nextIntersection;
};
