import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { extendSchema, extendSchemaSafe } from './extendSchema';

const getObjectKeys = (schema: z.ZodTypeAny) =>
  Object.keys((schema as z.ZodObject<z.ZodRawShape>).shape);

describe('extendSchema', () => {
  it('reorders object keys with head mode', () => {
    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string()
    });

    const extended = extendSchema(
      schema,
      {
        c: z.number(),
        x: z.boolean(),
        a: z.number()
      },
      { mode: 'head' }
    );

    expect(getObjectKeys(extended)).toEqual(['c', 'x', 'a', 'b']);
    expect(
      extended.safeParse({
        a: 1,
        b: 'b',
        c: 2,
        x: true
      }).success
    ).toBe(true);
  });

  it('preserves existing positions and appends only new keys in append mode', () => {
    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string()
    });

    const extended = extendSchema(
      schema,
      {
        c: z.number(),
        x: z.boolean(),
        a: z.number(),
        y: z.boolean()
      },
      { mode: 'append' }
    );

    expect(getObjectKeys(extended)).toEqual(['a', 'b', 'c', 'x', 'y']);
    expect(
      extended.safeParse({
        a: 1,
        b: 'b',
        c: 2,
        x: true,
        y: false
      }).success
    ).toBe(true);
  });

  it('preserves existing positions and prepends only new keys in prepend mode', () => {
    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string()
    });

    const extended = extendSchema(
      schema,
      {
        c: z.number(),
        x: z.boolean(),
        a: z.number(),
        y: z.boolean()
      },
      { mode: 'prepend' }
    );

    expect(getObjectKeys(extended)).toEqual(['x', 'y', 'a', 'b', 'c']);
    expect(
      extended.safeParse({
        a: 1,
        b: 'b',
        c: 2,
        x: true,
        y: false
      }).success
    ).toBe(true);
  });

  it('updates duplicate keys on both sides of intersections and prepends new keys to the left branch', () => {
    const schema = z.intersection(
      z.object({
        leftOnly: z.string(),
        shared: z.string()
      }),
      z.object({
        rightOnly: z.string(),
        shared: z.string()
      })
    );

    const extended = extendSchema(
      schema,
      {
        shared: z.number(),
        newField: z.boolean()
      },
      { mode: 'prepend' }
    );

    const intersection = extended as unknown as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>;
    const left = intersection._def.left as z.ZodObject<z.ZodRawShape>;
    const right = intersection._def.right as z.ZodObject<z.ZodRawShape>;

    expect(Object.keys(left.shape)).toEqual(['newField', 'leftOnly', 'shared']);
    expect(Object.keys(right.shape)).toEqual(['rightOnly', 'shared']);
    expect((left.shape.shared as z.ZodTypeAny).safeParse(1).success).toBe(true);
    expect((right.shape.shared as z.ZodTypeAny).safeParse(1).success).toBe(true);
    expect('newField' in right.shape).toBe(false);
  });

  it('extends object schemas and preserves the resulting order', () => {
    const objectSchema = z.object({
      id: z.string(),
      count: z.number()
    });

    const objectWithAction = extendSchema(
      objectSchema,
      {
        action: z.never().optional()
      },
      { mode: 'tail' }
    );

    expect(
      objectWithAction.safeParse({
        id: 'team-1',
        count: 1
      }).success
    ).toBe(true);

    const orderedObject = extendSchema(
      extendSchema(
        z.object({
          id: z.string(),
          name: z.string(),
          age: z.number()
        }),
        {
          age: z.number().int()
        },
        { mode: 'head' }
      ),
      {
        label: z.string()
      },
      { mode: 'tail' }
    );

    expectTypeOf({} as z.output<typeof orderedObject>).branded.toEqualTypeOf<{
      age: number;
      id: string;
      name: string;
      label: string;
    }>();

    expect(getObjectKeys(orderedObject)).toEqual(['age', 'id', 'name', 'label']);
    expect(
      orderedObject.safeParse({
        id: 'team-1',
        name: 'Alpha',
        age: 10,
        label: 'visible'
      }).success
    ).toBe(true);
  });
});

describe('extendSchemaSafe', () => {
  it('allows never-based keys without widening the public IO', () => {
    const objectSchema = z.object({
      id: z.string(),
      count: z.number()
    });

    const safeObjectWithAction = extendSchemaSafe(
      objectSchema,
      {
        action: z.never().optional()
      },
      { mode: 'tail' }
    );

    expectTypeOf(safeObjectWithAction).toEqualTypeOf(objectSchema);
    expect(
      safeObjectWithAction.safeParse({
        id: 'team-1',
        count: 1
      }).success
    ).toBe(true);
  });

  it('preserves the original IO for intersections', () => {
    const intersectionSchema = z.intersection(
      z.object({
        left: z.string()
      }),
      z.object({
        right: z.number()
      })
    );

    const safeIntersection = extendSchemaSafe(
      intersectionSchema,
      {
        right: z.number().int()
      },
      { mode: 'head' }
    );

    expectTypeOf(safeIntersection).toEqualTypeOf(intersectionSchema);
    expect(
      safeIntersection.safeParse({
        left: 'ok',
        right: 1
      }).success
    ).toBe(true);
  });

  it('preserves the original IO for unions when extending shared keys', () => {
    const unionSchema = z.union([
      z.object({
        kind: z.literal('a'),
        value: z.string()
      }),
      z.object({
        kind: z.literal('b'),
        value: z.string()
      })
    ]);

    const safeUnion = extendSchemaSafe(
      unionSchema,
      {
        value: z.string().trim()
      },
      { mode: 'tail' }
    );

    expectTypeOf(safeUnion).toEqualTypeOf(unionSchema);
    expect(
      safeUnion.safeParse({
        kind: 'a',
        value: 'hello'
      }).success
    ).toBe(true);
  });

  it('preserves the original IO for discriminated unions when extending shared keys', () => {
    const discriminatedUnionSchema = z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('alpha'),
        shared: z.string()
      }),
      z.object({
        kind: z.literal('beta'),
        shared: z.string()
      })
    ]);

    const safeDiscriminatedUnion = extendSchemaSafe(
      discriminatedUnionSchema,
      {
        shared: z.string().trim()
      },
      { mode: 'head' }
    );

    expectTypeOf(safeDiscriminatedUnion).toEqualTypeOf(discriminatedUnionSchema);
    expect(
      safeDiscriminatedUnion.safeParse({
        kind: 'alpha',
        shared: 'hello'
      }).success
    ).toBe(true);
  });

  it('rejects keys that would be new in some union arms', () => {
    const partialUnionSchema = z.union([
      z.object({
        kind: z.literal('a'),
        onlyA: z.string()
      }),
      z.object({
        kind: z.literal('b'),
        onlyB: z.number()
      })
    ]);

    const partialUnionExtended = extendSchema(
      partialUnionSchema,
      {
        onlyA: z.string()
      },
      { mode: 'tail' }
    );

    expectTypeOf({} as z.output<typeof partialUnionExtended>['onlyA']).toEqualTypeOf(
      '' as string
    );
    expect(
      partialUnionExtended.safeParse({
        kind: 'a',
        onlyA: 'ok'
      }).success
    ).toBe(true);

    expect(() =>
      extendSchemaSafe(
        partialUnionSchema,
        {
          onlyA: z.string()
        },
        { mode: 'tail' }
      )
    ).toThrowError(/unknown=onlyA/);
  });

  it('rejects unknown keys in extendSchemaSafe', () => {
    const schema = z.union([
      z.object({
        type: z.literal('a'),
        a: z.string()
      }),
      z.object({
        type: z.literal('b'),
        b: z.string()
      })
    ]);

    expect(() =>
      extendSchemaSafe(
        schema,
        {
          missing: z.string()
        },
        { mode: 'append' }
      )
    ).toThrow(/unknown=missing/);
  });
});
