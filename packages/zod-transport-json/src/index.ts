/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  postprocess,
  preprocess,
  type PostprocessorDef,
  type PreprocessorDef,
  type ProcessorDef,
} from "@zodapp/zod-transform";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

export type JsonTransport<TSchema extends z.ZodTypeAny> = {
  domainSchema: TSchema;
  transportSchema: z.ZodType<unknown>;
  decode: (input: unknown, context?: JsonTransportContext) => z.infer<TSchema>;
  encode: (value: z.infer<TSchema>, context?: JsonTransportContext) => unknown;
};

export type JsonTransportOptions = {
  allowLocalDateTime?: boolean;
};

export type JsonTransportContext = {
  timeZone?: string;
};

type ZodTypeWithDef = z.ZodTypeAny & {
  def: any;
  type: string;
};

const localDateTimeSchema = z.iso.datetime({ local: true });
const offsetDateTimeSchema = z.iso.datetime({ offset: true });

const isLocalDateTimeString = (value: string): boolean =>
  !offsetDateTimeSchema.safeParse(value).success && localDateTimeSchema.safeParse(value).success;

const createJsonPreprocessors = (context?: JsonTransportContext) =>
  ({
    date: (value: string | Date) => {
      if (value instanceof Date) return value;
      if (isLocalDateTimeString(value)) {
        if (!context?.timeZone) {
          throw new Error("timeZone is required to decode local datetime strings");
        }
        return dayjs.tz(value, context.timeZone).toDate();
      }
      return dayjs(value).toDate();
    },
    bigint: (value: string | bigint) => {
      return typeof value === "bigint" ? value : BigInt(value);
    },
    set: (value: unknown[] | Set<unknown>) => {
      return value instanceof Set ? value : new Set(value);
    },
    map: (value: Record<string, unknown> | Map<unknown, unknown>) => {
      return value instanceof Map ? value : new Map(Object.entries(value));
    },
  }) satisfies PreprocessorDef;

const createJsonPostprocessors = (context?: JsonTransportContext) =>
  ({
    date: (value: Date) => {
      return context?.timeZone
        ? dayjs(value).tz(context.timeZone).format("YYYY-MM-DDTHH:mm:ss.SSSZ")
        : value.toISOString();
    },
    bigint: (value: bigint) => {
      return value.toString();
    },
    set: (value: Set<unknown>) => {
      return Array.from(value);
    },
    map: (value: Map<unknown, unknown>) => {
      return Object.fromEntries(
        Array.from(value.entries()).map(([key, entryValue]) => {
          if (typeof key !== "string") {
            throw new Error("JSON transport only supports string Map keys");
          }
          return [key, entryValue];
        }),
      );
    },
  }) satisfies PostprocessorDef;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const stripUndefinedObjectFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedObjectFields);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedObjectFields(entryValue)]),
  );
};

const jsonProcessors = {
  object: (value, schema, context) => {
    if (!isPlainObject(value)) {
      return value;
    }

    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value)) {
      const childSchema = (schema.shape[key] ??
        schema.def.catchall) as z.ZodTypeAny | undefined;
      result[key] = childSchema
        ? context.transform(value[key], childSchema, key)
        : value[key];
    }
    return result;
  },
} satisfies ProcessorDef;

const assertZodType = (schema: z.ZodTypeAny): ZodTypeWithDef => {
  return schema as ZodTypeWithDef;
};

const isStringCompatibleMapKey = (schema: z.ZodTypeAny): boolean => {
  const zodSchema = assertZodType(schema);

  switch (zodSchema.type) {
    case "string":
      return true;
    case "literal": {
      const values = zodSchema.def.values as unknown[] | undefined;
      return values?.every((value) => typeof value === "string") === true;
    }
    case "enum": {
      const entries = Object.values(zodSchema.def.entries ?? {});
      return entries.every((value) => typeof value === "string");
    }
    case "union": {
      const options = zodSchema.def.options as z.ZodTypeAny[];
      return options.every(isStringCompatibleMapKey);
    }
    case "optional":
    case "nullable":
    case "default":
    case "catch":
    case "readonly":
      return isStringCompatibleMapKey(zodSchema.def.innerType as z.ZodTypeAny);
    default:
      return false;
  }
};

const toTransportSchema = (
  schema: z.ZodTypeAny,
  options: JsonTransportOptions,
): z.ZodType<unknown> => {
  const zodSchema = assertZodType(schema);

  switch (zodSchema.type) {
    case "date":
      return options.allowLocalDateTime
        ? z.union([z.iso.datetime({ offset: true }), z.iso.datetime({ local: true })])
        : z.iso.datetime({ offset: true });
    case "bigint":
      return z.string();
    case "array":
      return z.array(toTransportSchema(zodSchema.def.element as z.ZodTypeAny, options));
    case "tuple": {
      const items = (zodSchema.def.items as z.ZodTypeAny[]).map((item) =>
        toTransportSchema(item, options),
      );
      const rest = zodSchema.def.rest as z.ZodTypeAny | undefined;
      const tupleSchema =
        items.length === 0
          ? z.tuple([])
          : z.tuple(items as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
      return rest ? tupleSchema.rest(toTransportSchema(rest, options)) : tupleSchema;
    }
    case "set":
      return z.array(toTransportSchema(zodSchema.def.valueType as z.ZodTypeAny, options));
    case "map": {
      const keyType = zodSchema.def.keyType as z.ZodTypeAny;
      if (!isStringCompatibleMapKey(keyType)) {
        throw new Error("JSON transport only supports string-compatible Map keys");
      }
      return z.record(
        z.string(),
        toTransportSchema(zodSchema.def.valueType as z.ZodTypeAny, options),
      );
    }
    case "record":
      return z.record(
        z.string(),
        toTransportSchema(zodSchema.def.valueType as z.ZodTypeAny, options),
      );
    case "object": {
      const shape = zodSchema.def.shape as z.ZodRawShape;
      const transportShape = Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [
          key,
          toTransportSchema(value as z.ZodTypeAny, options),
        ]),
      );
      const objectSchema = z.object(transportShape);
      const catchall = zodSchema.def.catchall as z.ZodTypeAny | undefined;
      return catchall
        ? objectSchema.catchall(toTransportSchema(catchall, options))
        : objectSchema;
    }
    case "union": {
      const transportOptions = (zodSchema.def.options as z.ZodTypeAny[]).map(
        (option) => toTransportSchema(option, options),
      );
      return z.union(transportOptions as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    }
    case "intersection":
      return z.intersection(
        toTransportSchema(zodSchema.def.left as z.ZodTypeAny, options),
        toTransportSchema(zodSchema.def.right as z.ZodTypeAny, options),
      );
    case "optional":
      return toTransportSchema(zodSchema.def.innerType as z.ZodTypeAny, options).optional();
    case "nullable":
      return toTransportSchema(zodSchema.def.innerType as z.ZodTypeAny, options).nullable();
    case "default":
      return toTransportSchema(zodSchema.def.innerType as z.ZodTypeAny, options).default(
        zodSchema.def.defaultValue,
      );
    case "catch":
      return toTransportSchema(zodSchema.def.innerType as z.ZodTypeAny, options).catch(
        zodSchema.def.catchValue,
      );
    case "readonly":
      return toTransportSchema(zodSchema.def.innerType as z.ZodTypeAny, options).readonly();
    case "pipe":
      return z.pipe(
        toTransportSchema(zodSchema.def.in as z.ZodTypeAny, options),
        toTransportSchema(zodSchema.def.out as z.ZodTypeAny, options),
      );
    case "lazy":
      return z.lazy(() => toTransportSchema(zodSchema.def.getter(), options));
    default:
      return schema;
  }
};

export const createJsonTransport = <TSchema extends z.ZodTypeAny>(
  domainSchema: TSchema,
  options: JsonTransportOptions = {},
): JsonTransport<TSchema> => {
  const transportSchema = toTransportSchema(domainSchema, options);

  return {
    domainSchema,
    transportSchema,
    decode: (input: unknown, context?: JsonTransportContext) => {
      const transportValue = stripUndefinedObjectFields(
        transportSchema.parse(input),
      );
      const domainValue = preprocess(
        transportValue,
        domainSchema,
        createJsonPreprocessors(context),
        {
          processor: jsonProcessors,
        },
      );
      return stripUndefinedObjectFields(domainSchema.parse(domainValue)) as z.infer<TSchema>;
    },
    encode: (value: z.infer<TSchema>, context?: JsonTransportContext) => {
      const domainValue = domainSchema.parse(value);
      const transportValue = postprocess(
        domainValue,
        domainSchema,
        createJsonPostprocessors(context),
        {
          processor: jsonProcessors,
        },
      );
      return transportSchema.parse(transportValue);
    },
  };
};
