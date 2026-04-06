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
  return schema.clone();
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
