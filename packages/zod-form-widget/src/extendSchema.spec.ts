import { getMeta, zf } from "@zodapp/zod-form";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { extendSchema, extendSchemaSafe } from "./extendSchema";

type ObjectMeta = {
  properties?: string[];
};

const getObjectProperties = (schema: z.ZodTypeAny) =>
  (getMeta(schema, "object") as ObjectMeta | undefined)?.properties;

describe("extendSchema", () => {
  it("extends object schemas and keeps object property order metadata", () => {
    const objectSchema = z.object({
      id: z.string(),
      count: z.number(),
    });

    const objectWithAction = extendSchema(objectSchema, {
      after: {
        action: z.never().optional(),
      },
    });

    expect(
      objectWithAction.safeParse({
        id: "team-1",
        count: 1,
      }).success,
    ).toBe(true);

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

    expectTypeOf<z.output<typeof extendedObject>>().toEqualTypeOf<{
      id: string;
      name: string;
      age: number;
      label: string;
    }>();

    expect(
      extendedObject.safeParse({
        id: "team-1",
        name: "Alpha",
        age: 10,
        label: "visible",
      }).success,
    ).toBe(true);

    expect(getObjectProperties(extendedObject as z.ZodTypeAny)).toEqual([
      "age",
      "name",
      "id",
      "label",
    ]);
  });
});

describe("extendSchemaSafe", () => {
  it("allows never-based keys without widening the public IO", () => {
    const objectSchema = z.object({
      id: z.string(),
      count: z.number(),
    });

    const safeObjectWithAction = extendSchemaSafe(objectSchema, {
      after: {
        action: z.never().optional(),
      },
    });

    expectTypeOf<z.output<typeof safeObjectWithAction>>().toEqualTypeOf<
      z.output<typeof objectSchema>
    >();

    expect(
      safeObjectWithAction.safeParse({
        id: "team-1",
        count: 1,
      }).success,
    ).toBe(true);
  });

  it("preserves the original IO for intersections", () => {
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

    expectTypeOf<z.output<typeof safeIntersection>>().toEqualTypeOf<
      z.output<typeof intersectionSchema>
    >();

    expect(
      safeIntersection.safeParse({
        left: "ok",
        right: 1,
      }).success,
    ).toBe(true);
  });

  it("preserves the original IO for unions when extending shared keys", () => {
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

    expectTypeOf<z.output<typeof safeUnion>>().toEqualTypeOf<
      z.output<typeof unionSchema>
    >();

    expect(
      safeUnion.safeParse({
        kind: "a",
        value: "hello",
      }).success,
    ).toBe(true);
  });

  it("preserves the original IO for discriminated unions when extending shared keys", () => {
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

    const safeDiscriminatedUnion = extendSchemaSafe(discriminatedUnionSchema, {
      before: {
        shared: z.string().trim(),
      },
    });

    expectTypeOf<z.output<typeof safeDiscriminatedUnion>>().toEqualTypeOf<
      z.output<typeof discriminatedUnionSchema>
    >();

    expect(
      safeDiscriminatedUnion.safeParse({
        kind: "alpha",
        shared: "hello",
      }).success,
    ).toBe(true);
  });

  it("rejects keys that would be new in some union arms", () => {
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

    const partialUnionExtended = extendSchema(partialUnionSchema, {
      after: {
        onlyA: z.string(),
      },
    });

    expectTypeOf<
      z.output<typeof partialUnionExtended>["onlyA"]
    >().toEqualTypeOf<string>();

    expect(
      partialUnionExtended.safeParse({
        kind: "a",
        onlyA: "ok",
      }).success,
    ).toBe(true);

    expect(() =>
      extendSchemaSafe(partialUnionSchema, {
        after: {
          onlyA: z.string(),
        },
      }),
    ).toThrowError(/unknown=onlyA/);
  });
});
