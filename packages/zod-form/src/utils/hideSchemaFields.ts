import { getMeta, zf } from "../def";
import {
  cloneSchema,
  replaceArrayElement,
  replaceDiscriminatedUnionOptions,
  replaceIntersectionSides,
  replaceObjectShape,
  replaceUnionOptions,
  unwrapSchema,
} from "./schema";
import { z } from "zod";

const getUnionMeta = (schema: z.ZodTypeAny) => getMeta(schema, "union");

type MetaRecord = NonNullable<ReturnType<typeof getMeta<z.ZodTypeAny>>>;
type UnionMeta = NonNullable<ReturnType<typeof getUnionMeta>>;

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

type ApiName =
  | "hideSchemaFields"
  | "hideSchemaFieldsExcept"
  | "readOnlySchemaFields"
  | "readOnlySchemaFieldsExcept";

const pickDefinedMetaEntries = <T extends Record<string, unknown>>(
  meta: T | undefined,
): Partial<T> | undefined => {
  if (!meta) return undefined;

  const next = Object.fromEntries(
    Object.entries(meta).filter(
      ([key, value]) => key !== "typeName" && value !== undefined,
    ),
  ) as Partial<T>;

  return Object.keys(next).length > 0 ? next : undefined;
};

const pickMeta = (schema: z.ZodTypeAny): Partial<MetaRecord> | undefined => {
  return pickDefinedMetaEntries(getMeta(schema));
};

const cloneAsHidden = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  const { inner, rewrap } = unwrapSchema(schema);
  const cloned = rewrap(cloneSchema(inner));
  cloned.register(
    zf.hidden.registry,
    pickMeta(schema) ?? pickMeta(inner) ?? {},
  );
  return cloned;
};

const getSchemaRegistry = (schema: z.ZodTypeAny) => {
  const schemaType = (schema as z.ZodTypeAny & { type?: keyof typeof zf }).type;
  if (schemaType && schemaType in zf) {
    const registryHolder = zf[schemaType];
    if ("registry" in registryHolder) {
      return registryHolder.registry;
    }
  }
  return zf.common.registry;
};

const cloneAsReadOnly = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  const { inner, rewrap } = unwrapSchema(schema);
  const cloned = rewrap(cloneSchema(inner));
  const baseMeta =
    (getMeta(schema) as Record<string, unknown> | undefined) ??
    (getMeta(inner) as Record<string, unknown> | undefined) ??
    {};
  cloned.register(getSchemaRegistry(inner), {
    ...baseMeta,
    readOnly: true,
  });
  return cloned;
};

const isUnionSchema = (
  schema: z.ZodTypeAny,
): schema is
  | z.ZodUnion<readonly z.core.SomeType[]>
  | z.ZodDiscriminatedUnion<readonly z.core.SomeType[], string> => {
  return (
    schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion
  );
};

const cloneAsUnionSelectorState = (
  schema: z.ZodTypeAny,
  state: Partial<Pick<UnionMeta, "hideSelector" | "readOnlySelector">>,
): z.ZodTypeAny => {
  const { inner, rewrap } = unwrapSchema(schema);
  if (!isUnionSchema(inner)) return schema;

  const cloned = rewrap(cloneSchema(inner));
  const unionMeta = getUnionMeta(schema) ?? getUnionMeta(inner) ?? {};
  cloned.register(
    zf.union.registry as never,
    {
      ...unionMeta,
      ...state,
    } as never,
  );
  return cloned;
};

const hiddenSelectorResult = (
  schema: z.ZodTypeAny,
  matchedIndexes = new Set<number>(),
): ApplyResult => {
  return {
    schema: cloneAsUnionSelectorState(schema, { hideSelector: true }),
    changed: true,
    matchedIndexes,
  };
};

const readOnlySelectorResult = (
  schema: z.ZodTypeAny,
  matchedIndexes = new Set<number>(),
): ApplyResult => {
  return {
    schema: cloneAsUnionSelectorState(schema, { readOnlySelector: true }),
    changed: true,
    matchedIndexes,
  };
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

    const segments = normalized.split(".");
    if (segments.some((segment) => segment.length === 0)) {
      throw new Error(
        `${apiName}: path "${normalized}" contains an empty segment`,
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
        `${apiName}: overlapping paths are not supported (${current.raw}, ${other.raw})`,
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

const readOnlyResult = (
  schema: z.ZodTypeAny,
  matchedIndexes = new Set<number>(),
): ApplyResult => {
  return {
    schema: cloneAsReadOnly(schema),
    changed: true,
    matchedIndexes,
  };
};

type ApplyPolicy = {
  onLeafMatch: (
    schema: z.ZodTypeAny,
    leafPaths: readonly PathEntry[],
  ) => ApplyResult;
  onUnionContainer: (args: {
    schema: z.ZodTypeAny;
    matchedIndexes: ReadonlySet<number>;
    childChanged: boolean;
  }) => ApplyResult;
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
        apply: (nextSchema, nextPaths) =>
          applyWithPolicy(nextSchema, nextPaths, policy),
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
    const elementResult = applyWithPolicy(
      schema.element as z.ZodTypeAny,
      paths,
      policy,
    );
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
    const options = Array.from(
      schema.options as readonly z.ZodObject<z.ZodRawShape>[],
    );
    const optionResults = options.map((option) =>
      applyWithPolicy(option, paths, policy),
    );
    const matchedIndexes = mergeMatchedIndexes(optionResults);
    const childChanged = optionResults.some((result) => result.changed);

    if (!childChanged && matchedIndexes.size === 0) {
      return unchangedResult(schema, matchedIndexes);
    }

    const nextSchema = childChanged
      ? replaceDiscriminatedUnionOptions(
          schema,
          optionResults.map((result) => result.schema) as [
            z.ZodObject<z.ZodRawShape>,
            z.ZodObject<z.ZodRawShape>,
            ...z.ZodObject<z.ZodRawShape>[],
          ],
        )
      : schema;
    const containerResult = policy.onUnionContainer({
      schema: nextSchema,
      matchedIndexes,
      childChanged,
    });

    return {
      schema: containerResult.schema,
      changed: childChanged || containerResult.changed,
      matchedIndexes,
    };
  }

  if (schema instanceof z.ZodUnion) {
    const optionResults = Array.from(
      schema.options as readonly z.ZodTypeAny[],
    ).map((option) => applyWithPolicy(option, paths, policy));
    const matchedIndexes = mergeMatchedIndexes(optionResults);
    const childChanged = optionResults.some((result) => result.changed);

    if (!childChanged && matchedIndexes.size === 0) {
      return unchangedResult(schema, matchedIndexes);
    }

    const nextSchema = childChanged
      ? replaceUnionOptions(
          schema,
          optionResults.map((result) => result.schema) as [
            z.ZodTypeAny,
            z.ZodTypeAny,
            ...z.ZodTypeAny[],
          ],
        )
      : schema;
    const containerResult = policy.onUnionContainer({
      schema: nextSchema,
      matchedIndexes,
      childChanged,
    });

    return {
      schema: containerResult.schema,
      changed: childChanged || containerResult.changed,
      matchedIndexes,
    };
  }

  if (schema instanceof z.ZodIntersection) {
    const left = applyWithPolicy(
      schema._def.left as z.ZodTypeAny,
      paths,
      policy,
    );
    const right = applyWithPolicy(
      schema._def.right as z.ZodTypeAny,
      paths,
      policy,
    );
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

const applyHidden = (
  schema: z.ZodTypeAny,
  paths: readonly PathEntry[],
): ApplyResult =>
  applyWithPolicy(schema, paths, {
    onLeafMatch: (currentSchema, leafPaths) =>
      hiddenResult(currentSchema, new Set(leafPaths.map((path) => path.index))),
    onUnionContainer: ({ schema: currentSchema, matchedIndexes }) =>
      unchangedResult(currentSchema, new Set(matchedIndexes)),
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
      unchangedResult(
        currentSchema,
        new Set(leafPaths.map((path) => path.index)),
      ),
    onUnionContainer: ({ schema: currentSchema, matchedIndexes }) =>
      matchedIndexes.size > 0
        ? hiddenSelectorResult(currentSchema, new Set(matchedIndexes))
        : hiddenResult(currentSchema, new Set(matchedIndexes)),
    onObjectField: ({ child, nextPaths, apply }) => {
      if (nextPaths.length === 0) return hiddenResult(child);
      return apply(child, nextPaths);
    },
    onExhaustedTraversal: (currentSchema) => hiddenResult(currentSchema),
  });

const applyReadOnly = (
  schema: z.ZodTypeAny,
  paths: readonly PathEntry[],
): ApplyResult =>
  applyWithPolicy(schema, paths, {
    onLeafMatch: (currentSchema, leafPaths) =>
      readOnlyResult(
        currentSchema,
        new Set(leafPaths.map((path) => path.index)),
      ),
    onUnionContainer: ({ schema: currentSchema, matchedIndexes }) =>
      unchangedResult(currentSchema, new Set(matchedIndexes)),
    onObjectField: ({ child, nextPaths, apply }) => {
      if (nextPaths.length === 0) return unchangedResult(child);
      return apply(child, nextPaths);
    },
    onExhaustedTraversal: (currentSchema) => unchangedResult(currentSchema),
  });

const applyReadOnlyExcept = (
  schema: z.ZodTypeAny,
  paths: readonly PathEntry[],
): ApplyResult =>
  applyWithPolicy(schema, paths, {
    onLeafMatch: (currentSchema, leafPaths) =>
      unchangedResult(
        currentSchema,
        new Set(leafPaths.map((path) => path.index)),
      ),
    onUnionContainer: ({ schema: currentSchema, matchedIndexes }) =>
      matchedIndexes.size > 0
        ? readOnlySelectorResult(currentSchema, new Set(matchedIndexes))
        : readOnlyResult(currentSchema, new Set(matchedIndexes)),
    onObjectField: ({ child, nextPaths, apply }) => {
      if (nextPaths.length === 0) return readOnlyResult(child);
      return apply(child, nextPaths);
    },
    onExhaustedTraversal: (currentSchema) => readOnlyResult(currentSchema),
  });

export function hideSchemaFields<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths, "hideSchemaFields");
  if (paths.length === 0) return schema;

  const result = applyHidden(schema, paths);
  return result.schema as S;
}

export function hideSchemaFieldsExcept<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths, "hideSchemaFieldsExcept");
  const result = applyHiddenExcept(schema, paths);
  return result.schema as S;
}

export function readOnlySchemaFields<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths, "readOnlySchemaFields");
  if (paths.length === 0) return schema;

  const result = applyReadOnly(schema, paths);
  return result.schema as S;
}

export function readOnlySchemaFieldsExcept<S extends z.ZodTypeAny>(
  schema: S,
  options: { paths: readonly string[] },
): S {
  const paths = normalizePaths(options.paths, "readOnlySchemaFieldsExcept");
  const result = applyReadOnlyExcept(schema, paths);
  return result.schema as S;
}
