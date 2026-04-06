import { getMeta, zf } from './def';
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

type ApiName = 'hideSchemaFields' | 'hideSchemaFieldsExcept';

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

const normalizePaths = (
  paths: readonly string[],
  apiName: ApiName,
): PathEntry[] => {
  const unique = new Map<string, PathEntry>();

  for (const rawPath of paths) {
    const normalized = rawPath.trim();
    if (!normalized) {
      throw new Error(`${apiName}: path must not be empty`);
    }

    const segments = normalized.split('.');
    if (segments.some((segment) => segment.length === 0)) {
      throw new Error(`${apiName}: path "${normalized}" contains an empty segment`);
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
        `${apiName}: overlapping paths are not supported (${current.raw}, ${other.raw})`,
      );
    }
  }

  return entries.map((entry, index) => ({ ...entry, index }));
};

const assertAllPathsResolved = (
  apiName: ApiName,
  paths: readonly PathEntry[],
  matchedIndexes: ReadonlySet<number>,
) => {
  const unresolved = paths
    .filter((path) => !matchedIndexes.has(path.index))
    .map((path) => path.raw);

  if (unresolved.length > 0) {
    throw new Error(
      `${apiName}: unknown or non-traversable path(s): ${unresolved.join(', ')}`,
    );
  }
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

const unchangedResult = (
  schema: z.ZodTypeAny,
  matchedIndexes = new Set<number>(),
): ApplyResult => {
  return { schema, changed: false, matchedIndexes };
};

const hiddenResult = (
  schema: z.ZodTypeAny,
  matchedIndexes = new Set<number>(),
): ApplyResult => {
  return {
    schema: cloneAsHidden(schema),
    changed: true,
    matchedIndexes,
  };
};

type ApplyPolicy = {
  onLeafMatch: (
    schema: z.ZodTypeAny,
    leafPaths: readonly PathEntry[],
  ) => ApplyResult;
  onObjectField: (args: {
    key: string;
    child: z.ZodTypeAny;
    nextPaths: readonly PathEntry[];
    apply: (schema: z.ZodTypeAny, paths: readonly PathEntry[]) => ApplyResult;
  }) => ApplyResult;
  onExhaustedTraversal: (schema: z.ZodTypeAny) => ApplyResult;
};

const applyWithPolicy = (
  schema: z.ZodTypeAny,
  paths: readonly PathEntry[],
  policy: ApplyPolicy,
): ApplyResult => {
  const leafPaths = paths.filter((path) => path.segments.length === 0);
  if (leafPaths.length > 0) {
    return policy.onLeafMatch(schema, leafPaths);
  }

  const { inner, rewrap } = unwrapSchema(schema);
  if (inner !== schema) {
    const innerResult = applyWithPolicy(inner, paths, policy);
    if (!innerResult.changed) {
      return unchangedResult(schema, innerResult.matchedIndexes);
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

    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    for (const [key, child] of Object.entries(shape)) {
      const childResult = policy.onObjectField({
        key,
        child,
        nextPaths: grouped.get(key) ?? [],
        apply: (nextSchema, nextPaths) => applyWithPolicy(nextSchema, nextPaths, policy),
      });
      childResults.push(childResult);

      if (!childResult.changed) continue;

      if (nextShape === null) {
        nextShape = { ...shape };
      }
      nextShape[key] = childResult.schema;
    }

    if (nextShape === null) {
      return unchangedResult(schema, mergeMatchedIndexes(childResults));
    }

    return {
      schema: replaceObjectShape(schema, nextShape),
      changed: true,
      matchedIndexes: mergeMatchedIndexes(childResults),
    };
  }

  if (paths.length === 0) {
    return policy.onExhaustedTraversal(schema);
  }

  if (schema instanceof z.ZodArray) {
    const elementResult = applyWithPolicy(schema.element as z.ZodTypeAny, paths, policy);
    if (!elementResult.changed) {
      return unchangedResult(schema, elementResult.matchedIndexes);
    }

    return {
      schema: replaceArrayElement(schema, elementResult.schema),
      changed: true,
      matchedIndexes: elementResult.matchedIndexes,
    };
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema.options as readonly z.ZodObject<z.ZodRawShape>[]);
    const optionResults = options.map((option) => applyWithPolicy(option, paths, policy));
    const matchedIndexes = mergeMatchedIndexes(optionResults);

    if (!optionResults.some((result) => result.changed)) {
      return unchangedResult(schema, matchedIndexes);
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
      (option) => applyWithPolicy(option, paths, policy),
    );
    const matchedIndexes = mergeMatchedIndexes(optionResults);

    if (!optionResults.some((result) => result.changed)) {
      return unchangedResult(schema, matchedIndexes);
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
    const left = applyWithPolicy(schema._def.left as z.ZodTypeAny, paths, policy);
    const right = applyWithPolicy(schema._def.right as z.ZodTypeAny, paths, policy);
    const matchedIndexes = mergeMatchedIndexes([left, right]);

    if (!left.changed && !right.changed) {
      return unchangedResult(schema, matchedIndexes);
    }

    return {
      schema: replaceIntersectionSides(schema, left.schema, right.schema),
      changed: true,
      matchedIndexes,
    };
  }

  return unchangedResult(schema);
};

const applyHidden = (schema: z.ZodTypeAny, paths: readonly PathEntry[]): ApplyResult =>
  applyWithPolicy(schema, paths, {
    onLeafMatch: (currentSchema, leafPaths) =>
      hiddenResult(currentSchema, new Set(leafPaths.map((path) => path.index))),
    onObjectField: ({ child, nextPaths, apply }) => {
      if (nextPaths.length === 0) return unchangedResult(child);
      return apply(child, nextPaths);
    },
    onExhaustedTraversal: (currentSchema) => unchangedResult(currentSchema),
  });

const applyHiddenExcept = (
  schema: z.ZodTypeAny,
  paths: readonly PathEntry[],
): ApplyResult =>
  applyWithPolicy(schema, paths, {
    onLeafMatch: (currentSchema, leafPaths) =>
      unchangedResult(currentSchema, new Set(leafPaths.map((path) => path.index))),
    onObjectField: ({ child, nextPaths, apply }) => {
      if (nextPaths.length === 0) return hiddenResult(child);
      return apply(child, nextPaths);
    },
    onExhaustedTraversal: (currentSchema) => hiddenResult(currentSchema),
  });

export function hideSchemaFields<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths, 'hideSchemaFields');
  if (paths.length === 0) return schema;

  const result = applyHidden(schema, paths);
  assertAllPathsResolved('hideSchemaFields', paths, result.matchedIndexes);

  return result.schema as S;
}

export function hideSchemaFieldsExcept<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths, 'hideSchemaFieldsExcept');
  const result = applyHiddenExcept(schema, paths);
  assertAllPathsResolved('hideSchemaFieldsExcept', paths, result.matchedIndexes);

  return result.schema as S;
}
