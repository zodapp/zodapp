import { getMeta, zf } from '@zodapp/zod-form';
import { z } from 'zod';

type CommonMeta = {
  label?: string;
  uiType?: string;
  tags?: string[];
  hidden?: boolean;
  readOnly?: boolean;
  color?: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

type Wrapper =
  | { kind: 'optional' }
  | { kind: 'nullable' }
  | { kind: 'default'; defaultValue: unknown };

type PathEntry = {
  index: number;
  raw: string;
  segments: string[];
};

type ApplyResult = {
  schema: z.ZodTypeAny;
  changed: boolean;
  matchedIndexes: Set<number>;
};

/**
 * Zod スキーマを公開 API のみで clone する。
 * .describe() は新しいインスタンスを返すため、private field を差し替える土台に使える。
 */
function cloneSchema<T extends z.ZodTypeAny>(schema: T): T {
  return schema.describe(schema.description as string);
}

const pickCommonMeta = (schema: z.ZodTypeAny): CommonMeta | undefined => {
  const meta = getMeta(schema) as CommonMeta | undefined;
  if (!meta) return undefined;

  const next: CommonMeta = {};

  if (meta.label !== undefined) next.label = meta.label;
  if (meta.uiType !== undefined) next.uiType = meta.uiType;
  if (meta.tags !== undefined) next.tags = meta.tags;
  if (meta.hidden !== undefined) next.hidden = meta.hidden;
  if (meta.readOnly !== undefined) next.readOnly = meta.readOnly;
  if (meta.color !== undefined) next.color = meta.color;
  if (meta.width !== undefined) next.width = meta.width;
  if (meta.align !== undefined) next.align = meta.align;

  return Object.keys(next).length > 0 ? next : undefined;
};

const cloneAsHidden = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  const cloned = cloneSchema(schema);
  cloned.register(zf.hidden.registry, pickCommonMeta(schema) ?? {});
  return cloned;
};

const unwrapSchema = (schema: z.ZodTypeAny) => {
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
      if (wrapper.kind === 'optional') return acc.optional();
      if (wrapper.kind === 'nullable') return acc.nullable();
      return acc.default(wrapper.defaultValue as never);
    }, next);

  return { inner: current, rewrap };
};

const replaceObjectShape = (
  schema: z.ZodObject<z.ZodRawShape>,
  nextShape: z.ZodRawShape,
): z.ZodObject<z.ZodRawShape> => {
  let nextObject = z.object(nextShape);
  if (schema.description !== undefined) {
    nextObject = nextObject.describe(schema.description);
  }

  const objectMeta = getMeta(schema, 'object');
  if (objectMeta) {
    nextObject = nextObject.register(
      zf.object.registry as never,
      objectMeta as never,
    );
  }

  return nextObject as z.ZodObject<z.ZodRawShape>;
};

const replaceArrayElement = (
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

const replaceUnionOptions = (
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

const replaceIntersectionSides = (
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

const normalizePaths = (paths: readonly string[]): PathEntry[] => {
  const unique = new Map<string, PathEntry>();

  for (const rawPath of paths) {
    const normalized = rawPath.trim();
    if (!normalized) {
      throw new Error('hideSchemaFields: path must not be empty');
    }

    const segments = normalized.split('.');
    if (segments.some((segment) => segment.length === 0)) {
      throw new Error(
        `hideSchemaFields: path "${normalized}" contains an empty segment`,
      );
    }

    if (!unique.has(normalized)) {
      unique.set(normalized, {
        index: unique.size,
        raw: normalized,
        segments,
      });
    }
  }

  const entries = Array.from(unique.values()).sort((left, right) =>
    left.raw.localeCompare(right.raw),
  );

  for (const [i, current] of entries.entries()) {
    for (const other of entries.slice(i + 1)) {
      if (!other.raw.startsWith(`${current.raw}.`)) continue;
      throw new Error(
        `hideSchemaFields: overlapping paths are not supported (${current.raw}, ${other.raw})`,
      );
    }
  }

  return entries.map((entry, index) => ({ ...entry, index }));
};

const mergeMatchedIndexes = (results: ApplyResult[]): Set<number> => {
  const merged = new Set<number>();
  for (const result of results) {
    for (const index of result.matchedIndexes) {
      merged.add(index);
    }
  }
  return merged;
};

const applyHidden = (
  schema: z.ZodTypeAny,
  paths: readonly PathEntry[],
): ApplyResult => {
  if (paths.length === 0) {
    return {
      schema,
      changed: false,
      matchedIndexes: new Set<number>(),
    };
  }

  const leafPaths = paths.filter((path) => path.segments.length === 0);
  if (leafPaths.length > 0) {
    return {
      schema: cloneAsHidden(schema),
      changed: true,
      matchedIndexes: new Set(leafPaths.map((path) => path.index)),
    };
  }

  const { inner, rewrap } = unwrapSchema(schema);
  if (inner !== schema) {
    const innerResult = applyHidden(inner, paths);
    if (!innerResult.changed) {
      return { schema, changed: false, matchedIndexes: innerResult.matchedIndexes };
    }

    return {
      schema: rewrap(innerResult.schema),
      changed: true,
      matchedIndexes: innerResult.matchedIndexes,
    };
  }

  if (schema instanceof z.ZodObject) {
    const grouped = new Map<string, PathEntry[]>();
    for (const path of paths) {
      const [head, ...rest] = path.segments;
      if (!head) continue;
      const current = grouped.get(head) ?? [];
      current.push({ ...path, segments: rest });
      grouped.set(head, current);
    }

    const childResults: ApplyResult[] = [];
    let nextShape: Record<string, z.ZodTypeAny> | null = null;

    for (const [key, nextPaths] of grouped) {
      const child = schema.shape[key] as z.ZodTypeAny | undefined;
      if (!child) continue;

      const childResult = applyHidden(child, nextPaths);
      childResults.push(childResult);

      if (!childResult.changed) continue;

      if (nextShape === null) {
        nextShape = { ...(schema.shape as Record<string, z.ZodTypeAny>) };
      }
      nextShape[key] = childResult.schema;
    }

    if (nextShape === null) {
      return {
        schema,
        changed: false,
        matchedIndexes: mergeMatchedIndexes(childResults),
      };
    }

    return {
      schema: replaceObjectShape(schema, nextShape),
      changed: true,
      matchedIndexes: mergeMatchedIndexes(childResults),
    };
  }

  if (schema instanceof z.ZodArray) {
    const elementResult = applyHidden(schema.element as z.ZodTypeAny, paths);
    if (!elementResult.changed) {
      return {
        schema,
        changed: false,
        matchedIndexes: elementResult.matchedIndexes,
      };
    }

    return {
      schema: replaceArrayElement(schema, elementResult.schema),
      changed: true,
      matchedIndexes: elementResult.matchedIndexes,
    };
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema.options as readonly z.ZodObject<z.ZodRawShape>[]);
    const optionResults = options.map((option) => applyHidden(option, paths));
    const matchedIndexes = mergeMatchedIndexes(optionResults);

    if (!optionResults.some((result) => result.changed)) {
      return { schema, changed: false, matchedIndexes };
    }

    const discriminator = (
      schema as unknown as { _def: { discriminator: string } }
    )._def.discriminator;

    let nextUnion = z.discriminatedUnion(
      discriminator,
      optionResults.map((result) => result.schema) as [
        z.ZodObject<z.ZodRawShape>,
        z.ZodObject<z.ZodRawShape>,
        ...z.ZodObject<z.ZodRawShape>[],
      ],
    );

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

    return {
      schema: nextUnion,
      changed: true,
      matchedIndexes,
    };
  }

  if (schema instanceof z.ZodUnion) {
    const optionResults = Array.from(schema.options as readonly z.ZodTypeAny[]).map(
      (option) => applyHidden(option, paths),
    );
    const matchedIndexes = mergeMatchedIndexes(optionResults);

    if (!optionResults.some((result) => result.changed)) {
      return { schema, changed: false, matchedIndexes };
    }

    return {
      schema: replaceUnionOptions(
        schema,
        optionResults.map((result) => result.schema) as [
          z.ZodTypeAny,
          z.ZodTypeAny,
          ...z.ZodTypeAny[],
        ],
      ),
      changed: true,
      matchedIndexes,
    };
  }

  if (schema instanceof z.ZodIntersection) {
    const left = applyHidden(schema._def.left as z.ZodTypeAny, paths);
    const right = applyHidden(schema._def.right as z.ZodTypeAny, paths);
    const matchedIndexes = mergeMatchedIndexes([left, right]);

    if (!left.changed && !right.changed) {
      return { schema, changed: false, matchedIndexes };
    }

    return {
      schema: replaceIntersectionSides(schema, left.schema, right.schema),
      changed: true,
      matchedIndexes,
    };
  }

  return {
    schema,
    changed: false,
    matchedIndexes: new Set<number>(),
  };
};

export function hideSchemaFields<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths);
  if (paths.length === 0) return schema;

  const result = applyHidden(schema, paths);
  const unresolved = paths
    .filter((path) => !result.matchedIndexes.has(path.index))
    .map((path) => path.raw);

  if (unresolved.length > 0) {
    throw new Error(
      `hideSchemaFields: unknown or non-traversable path(s): ${unresolved.join(', ')}`,
    );
  }

  return result.schema as S;
}
