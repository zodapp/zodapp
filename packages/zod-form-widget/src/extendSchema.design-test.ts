import { getMeta, zf } from "@zodapp/zod-form";
import { z } from "zod";

import { extendSchema, extendSchemaSafe } from "./extendSchema";

type Assert<T extends true> = T;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? ((<T>() => T extends B ? 1 : 2) extends
        (<T>() => T extends A ? 1 : 2)
        ? true
        : false)
    : false;

type Extends<A, B> = A extends B ? true : false;

type ObjectMeta = {
  properties?: string[];
};

function assertRuntime(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// 1. plain object: before/after + properties 順序
// ---------------------------------------------------------------------------

const objectSchema = z.object({
  id: z.string(),
  count: z.number(),
});

const objectWithAction = extendSchema(objectSchema, {
  after: {
    action: z.never().optional(),
  },
});

const orderedObjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    age: z.number(),
  })
  .register(zf.object.registry, {
    properties: ["name", "id"],
  });

const extendedObject = extendSchema(orderedObjectSchema, {
  before: {
    age: z.number().int(),
  },
  after: {
    label: z.string(),
  },
});

type ExtendedObjectOutput = z.output<typeof extendedObject>;
type _extendedObjectId = Assert<Equal<ExtendedObjectOutput["id"], string>>;
type _extendedObjectAge = Assert<Equal<ExtendedObjectOutput["age"], number>>;
type _extendedObjectLabel = Assert<Equal<ExtendedObjectOutput["label"], string>>;

const extendedObjectParse = extendedObject.safeParse({
  id: "team-1",
  name: "Alpha",
  age: 10,
  label: "visible",
});
assertRuntime(
  extendedObjectParse.success,
  "extendSchema(object) should parse the merged schema",
);

const objectWithActionParse = objectWithAction.safeParse({
  id: "team-1",
  count: 1,
});
assertRuntime(
  objectWithActionParse.success,
  "never optional action should be omittable",
);

const extendedObjectMeta = getMeta(
  extendedObject as unknown as z.ZodTypeAny,
  "object",
) as ObjectMeta | undefined;
assertRuntime(
  extendedObjectMeta?.properties?.join(",") === "age,name,id,label",
  "properties should follow the same merge rule as shape",
);

// ---------------------------------------------------------------------------
// 2. intersection: before -> left, after -> right
// ---------------------------------------------------------------------------

const intersectionSchema = z.intersection(
  z.object({
    left: z.string(),
  }),
  z.object({
    right: z.number(),
  }),
);

const safeIntersection = extendSchemaSafe(intersectionSchema, {
  before: {
    right: z.number().int(),
  },
});

type SafeIntersectionOutput = z.output<typeof safeIntersection>;
type _safeIntersectionOutput = Assert<
  Equal<SafeIntersectionOutput, z.output<typeof intersectionSchema>>
>;

const safeIntersectionParse = safeIntersection.safeParse({
  left: "ok",
  right: 1,
});
assertRuntime(
  safeIntersectionParse.success,
  "extendSchemaSafe(intersection) should keep the original IO",
);

// ---------------------------------------------------------------------------
// 3. union: shared key は safe で通る
// ---------------------------------------------------------------------------

const unionSchema = z.union([
  z.object({
    kind: z.literal("a"),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("b"),
    value: z.string(),
  }),
]);

const safeUnion = extendSchemaSafe(unionSchema, {
  after: {
    value: z.string().trim(),
  },
});

type SafeUnionOutput = z.output<typeof safeUnion>;
type _safeUnionOutputA = Assert<
  Extends<SafeUnionOutput, z.output<typeof unionSchema>>
>;
type _safeUnionOutputB = Assert<
  Extends<z.output<typeof unionSchema>, SafeUnionOutput>
>;

const safeUnionParse = safeUnion.safeParse({
  kind: "a",
  value: "hello",
});
assertRuntime(
  safeUnionParse.success,
  "extendSchemaSafe(union) should work for shared keys",
);

// ---------------------------------------------------------------------------
// 4. discriminatedUnion: shared key は safe で通る
// ---------------------------------------------------------------------------

const discriminatedUnionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("alpha"),
    shared: z.string(),
  }),
  z.object({
    kind: z.literal("beta"),
    shared: z.string(),
  }),
]);

const _safeDiscriminatedUnion = extendSchemaSafe(discriminatedUnionSchema, {
  before: {
    shared: z.string().trim(),
  },
});

type SafeDiscriminatedUnionOutput = z.output<typeof _safeDiscriminatedUnion>;
type _safeDiscriminatedUnionOutputA = Assert<
  Extends<
    SafeDiscriminatedUnionOutput,
    z.output<typeof discriminatedUnionSchema>
  >
>;
type _safeDiscriminatedUnionOutputB = Assert<
  Extends<
    z.output<typeof discriminatedUnionSchema>,
    SafeDiscriminatedUnionOutput
  >
>;

// ---------------------------------------------------------------------------
// 5. partial union: extendSchema は通るが extendSchemaSafe は reject
// ---------------------------------------------------------------------------

const partialUnionSchema = z.union([
  z.object({
    kind: z.literal("a"),
    onlyA: z.string(),
  }),
  z.object({
    kind: z.literal("b"),
    onlyB: z.number(),
  }),
]);

const _partialUnionExtended = extendSchema(partialUnionSchema, {
  after: {
    onlyA: z.string(),
  },
});

type PartialUnionExtendedOutput = z.output<typeof _partialUnionExtended>;
type _partialUnionExtendedOnlyA = Assert<
  Equal<PartialUnionExtendedOutput["onlyA"], string>
>;

let didThrowForPartialUnion = false;
try {
  extendSchemaSafe(partialUnionSchema, {
    after: {
      onlyA: z.string(),
    },
  });
} catch {
  didThrowForPartialUnion = true;
}

assertRuntime(
  didThrowForPartialUnion,
  "extendSchemaSafe should reject keys that would be new in some union arms",
);

export {};
