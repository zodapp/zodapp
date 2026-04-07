import { getMeta, zf } from '@zodapp/zod-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { mergeSchemaWithObject } from './schemaTransform';

describe('mergeSchemaWithObject', () => {
  it('keeps overlapping fields as-is and appends only new fields', () => {
    const base = z.object({
      id: z.string().optional(),
      title: z.string()
    });
    const delta = z.object({
      id: z.number(),
      extra: z.boolean()
    });

    const merged = mergeSchemaWithObject(base, delta, 'asIs') as z.ZodObject<z.ZodRawShape>;
    const idField = merged.shape.id as z.ZodTypeAny;

    expect(Object.keys(merged.shape)).toEqual(['id', 'title', 'extra']);
    expect(idField.safeParse('doc-1').success).toBe(true);
    expect(idField.safeParse(1).success).toBe(false);
    expect(
      merged.safeParse({
        title: 'hello',
        extra: true
      }).success
    ).toBe(true);
  });

  it('materializes required fields from the current top-level object shape', () => {
    const base = z.object({
      id: z.string().optional(),
      hiddenId: z
        .string()
        .register(zf.hidden.registry, { label: 'Hidden ID' })
        .optional()
    });
    const delta = z.object({
      id: z.number(),
      hiddenId: z.string(),
      extra: z.boolean().optional()
    });

    const merged = mergeSchemaWithObject(base, delta, 'required') as z.ZodObject<z.ZodRawShape>;
    const idField = merged.shape.id as z.ZodTypeAny;
    const extraField = merged.shape.extra as z.ZodTypeAny;
    const hiddenIdField = merged.shape.hiddenId as z.ZodTypeAny;

    expect(idField.safeParse(undefined).success).toBe(false);
    expect(idField.safeParse('doc-1').success).toBe(true);
    expect(extraField.safeParse(undefined).success).toBe(false);
    expect(extraField.safeParse(true).success).toBe(true);
    expect((getMeta(hiddenIdField) as { typeName?: string } | undefined)?.typeName).toBe(
      'hidden'
    );
  });

  it('applies the same top-level merge to every branch of an intersection', () => {
    const base = z.intersection(
      z.object({
        leftOnly: z.string().optional(),
        shared: z.string().optional()
      }),
      z.object({
        rightOnly: z.string().optional(),
        shared: z.string().optional()
      })
    );
    const delta = z.object({
      shared: z.number(),
      extra: z.boolean().optional()
    });

    const merged = mergeSchemaWithObject(base, delta, 'required') as z.ZodIntersection<
      z.ZodTypeAny,
      z.ZodTypeAny
    >;
    const left = merged._def.left as z.ZodObject<z.ZodRawShape>;
    const right = merged._def.right as z.ZodObject<z.ZodRawShape>;
    const leftShared = left.shape.shared as z.ZodTypeAny;
    const rightShared = right.shape.shared as z.ZodTypeAny;
    const rightExtra = right.shape.extra as z.ZodTypeAny;

    expect(Object.keys(left.shape)).toEqual(['leftOnly', 'shared', 'extra']);
    expect(Object.keys(right.shape)).toEqual(['rightOnly', 'shared', 'extra']);
    expect(leftShared.safeParse('left').success).toBe(true);
    expect(rightShared.safeParse('right').success).toBe(true);
    expect(leftShared.safeParse(undefined).success).toBe(false);
    expect(rightExtra.safeParse(false).success).toBe(true);
  });
});
