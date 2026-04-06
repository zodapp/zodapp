import { getMeta, zf } from './def';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { hideSchemaFields, hideSchemaFieldsExcept } from './hideSchemaFields';

type ObjectMeta = {
  properties?: string[];
};

type FieldMeta = {
  hidden?: boolean;
  typeName?: string;
};

const getObjectProperties = (schema: z.ZodTypeAny) =>
  (getMeta(schema, 'object') as ObjectMeta | undefined)?.properties;

const getObjectField = (schema: z.ZodObject<z.ZodRawShape>, key: string) =>
  schema.shape[key] as z.ZodTypeAny;

const isHiddenField = (schema: z.ZodTypeAny) => {
  const meta = getMeta(schema) as FieldMeta | undefined;
  return meta?.hidden === true || meta?.typeName === 'hidden';
};

describe('hideSchemaFields', () => {
  it('hides top-level fields without changing the public type', () => {
    const schema = z.object({
      name: z.string().register(zf.string.registry, { label: 'Name' }),
      avatarImage: z
        .string()
        .register(zf.string.registry, { label: 'Avatar' })
        .optional(),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['avatarImage'],
    });

    expectTypeOf(hiddenSchema).toEqualTypeOf(schema);
    expect(
      hiddenSchema.safeParse({
        name: 'Ada',
        avatarImage: 'avatar.png',
      }).success,
    ).toBe(true);
    expect(isHiddenField(getObjectField(hiddenSchema, 'avatarImage'))).toBe(true);
  });

  it('hides nested object fields and preserves object property metadata', () => {
    const profileSchema = z
      .object({
        name: z.string().register(zf.string.registry, { label: 'Name' }),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      })
      .register(zf.object.registry, {
        properties: ['secret', 'name'],
      });

    const schema = z.object({
      profile: profileSchema,
      note: z.string().register(zf.string.registry, { label: 'Note' }),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['profile.secret'],
    });

    const hiddenProfile = getObjectField(
      hiddenSchema,
      'profile',
    ) as z.ZodObject<z.ZodRawShape>;

    expect(isHiddenField(getObjectField(hiddenProfile, 'secret'))).toBe(true);
    expect(getObjectProperties(hiddenProfile)).toEqual(['secret', 'name']);
    expect(getObjectField(hiddenSchema, 'note')).toBe(getObjectField(schema, 'note'));
  });

  it('hides fields inside array elements', () => {
    const memberSchema = z.object({
      displayName: z.string().register(zf.string.registry, { label: 'Display Name' }),
      avatarImage: z
        .string()
        .register(zf.string.registry, { label: 'Avatar' })
        .optional(),
    });

    const schema = z.object({
      members: z.array(memberSchema).register(zf.array.registry, {
        label: 'Members',
      }),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['members.avatarImage'],
    });

    const hiddenMembers = getObjectField(
      hiddenSchema,
      'members',
    ) as z.ZodArray<z.ZodTypeAny>;
    const hiddenMember = hiddenMembers.element as z.ZodObject<z.ZodRawShape>;

    expect(isHiddenField(getObjectField(hiddenMember, 'avatarImage'))).toBe(true);
    expect(
      hiddenSchema.safeParse({
        members: [{ displayName: 'Ada', avatarImage: 'avatar.png' }],
      }).success,
    ).toBe(true);
  });

  it('recursively updates union arms', () => {
    const unionSchema = z.union([
      z.object({
        kind: z.literal('a'),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      }),
      z.object({
        kind: z.literal('b'),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      }),
    ]);

    const hiddenUnion = hideSchemaFields(unionSchema, {
      paths: ['secret'],
    });

    expectTypeOf(hiddenUnion).toEqualTypeOf(unionSchema);
    for (const option of hiddenUnion.options as unknown as z.ZodObject<z.ZodRawShape>[]) {
      expect(isHiddenField(getObjectField(option, 'secret'))).toBe(true);
    }
  });

  it('recursively updates discriminated union arms', () => {
    const discriminatedUnionSchema = z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('alpha'),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      }),
      z.object({
        kind: z.literal('beta'),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      }),
    ]);

    const hiddenUnion = hideSchemaFields(discriminatedUnionSchema, {
      paths: ['secret'],
    });

    expectTypeOf(hiddenUnion).toEqualTypeOf(discriminatedUnionSchema);
    for (const option of hiddenUnion.options as unknown as z.ZodObject<z.ZodRawShape>[]) {
      expect(isHiddenField(getObjectField(option, 'secret'))).toBe(true);
    }
  });

  it('recursively updates intersection branches', () => {
    const intersectionSchema = z.intersection(
      z.object({
        left: z.string().register(zf.string.registry, { label: 'Left' }),
      }),
      z.object({
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      }),
    );

    const hiddenIntersection = hideSchemaFields(intersectionSchema, {
      paths: ['secret'],
    });

    expectTypeOf(hiddenIntersection).toEqualTypeOf(intersectionSchema);
    expect(
      hiddenIntersection.safeParse({
        left: 'ok',
        secret: 'hidden',
      }).success,
    ).toBe(true);

    const right = hiddenIntersection._def.right as z.ZodObject<z.ZodRawShape>;
    expect(isHiddenField(getObjectField(right, 'secret'))).toBe(true);
  });

  it('throws when a path is unknown', () => {
    const schema = z.object({
      name: z.string(),
    });

    expect(() =>
      hideSchemaFields(schema, {
        paths: ['missing'],
      }),
    ).toThrowError(/unknown or non-traversable path/);
  });

  it('throws when trying to traverse into a leaf field', () => {
    const schema = z.object({
      name: z.string(),
    });

    expect(() =>
      hideSchemaFields(schema, {
        paths: ['name.first'],
      }),
    ).toThrowError(/unknown or non-traversable path/);
  });
});

describe('hideSchemaFieldsExcept', () => {
  it('keeps only top-level fields without changing the public type', () => {
    const schema = z.object({
      name: z.string().register(zf.string.registry, { label: 'Name' }),
      avatarImage: z
        .string()
        .register(zf.string.registry, { label: 'Avatar' })
        .optional(),
    });

    const hiddenSchema = hideSchemaFieldsExcept(schema, {
      paths: ['name'],
    });

    expectTypeOf(hiddenSchema).toEqualTypeOf(schema);
    expect(isHiddenField(getObjectField(hiddenSchema, 'name'))).toBe(false);
    expect(isHiddenField(getObjectField(hiddenSchema, 'avatarImage'))).toBe(true);
  });

  it('keeps nested object fields and hides sibling fields recursively', () => {
    const profileSchema = z
      .object({
        name: z.string().register(zf.string.registry, { label: 'Name' }),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      })
      .register(zf.object.registry, {
        properties: ['secret', 'name'],
      });

    const schema = z.object({
      profile: profileSchema,
      note: z.string().register(zf.string.registry, { label: 'Note' }),
    });

    const hiddenSchema = hideSchemaFieldsExcept(schema, {
      paths: ['profile.name'],
    });

    const hiddenProfile = getObjectField(
      hiddenSchema,
      'profile',
    ) as z.ZodObject<z.ZodRawShape>;

    expect(isHiddenField(getObjectField(hiddenProfile, 'name'))).toBe(false);
    expect(isHiddenField(getObjectField(hiddenProfile, 'secret'))).toBe(true);
    expect(getObjectProperties(hiddenProfile)).toEqual(['secret', 'name']);
    expect(isHiddenField(getObjectField(hiddenSchema, 'note'))).toBe(true);
  });

  it('keeps exact object paths as visible subtrees', () => {
    const profileSchema = z.object({
      name: z.string().register(zf.string.registry, { label: 'Name' }),
      secret: z.string().register(zf.string.registry, { label: 'Secret' }),
    });

    const schema = z.object({
      profile: profileSchema,
      note: z.string().register(zf.string.registry, { label: 'Note' }),
    });

    const hiddenSchema = hideSchemaFieldsExcept(schema, {
      paths: ['profile'],
    });

    expect(getObjectField(hiddenSchema, 'profile')).toBe(getObjectField(schema, 'profile'));
    expect(isHiddenField(getObjectField(hiddenSchema, 'note'))).toBe(true);
  });

  it('keeps fields inside array elements', () => {
    const memberSchema = z.object({
      displayName: z.string().register(zf.string.registry, { label: 'Display Name' }),
      avatarImage: z
        .string()
        .register(zf.string.registry, { label: 'Avatar' })
        .optional(),
    });

    const schema = z.object({
      members: z.array(memberSchema).register(zf.array.registry, {
        label: 'Members',
      }),
    });

    const hiddenSchema = hideSchemaFieldsExcept(schema, {
      paths: ['members.displayName'],
    });

    const hiddenMembers = getObjectField(
      hiddenSchema,
      'members',
    ) as z.ZodArray<z.ZodTypeAny>;
    const hiddenMember = hiddenMembers.element as z.ZodObject<z.ZodRawShape>;

    expect(isHiddenField(getObjectField(hiddenMember, 'displayName'))).toBe(false);
    expect(isHiddenField(getObjectField(hiddenMember, 'avatarImage'))).toBe(true);
  });

  it('throws when a path is unknown', () => {
    const schema = z.object({
      name: z.string(),
    });

    expect(() =>
      hideSchemaFieldsExcept(schema, {
        paths: ['missing'],
      }),
    ).toThrowError(/unknown or non-traversable path/);
  });

  it('throws when trying to traverse into a leaf field', () => {
    const schema = z.object({
      name: z.string(),
    });

    expect(() =>
      hideSchemaFieldsExcept(schema, {
        paths: ['name.first'],
      }),
    ).toThrowError(/unknown or non-traversable path/);
  });
});
