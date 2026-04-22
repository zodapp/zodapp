import { getMeta, zf } from '../def';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  hideSchemaFields,
  hideSchemaFieldsExcept,
  readOnlySchemaFieldsExcept,
} from './hideSchemaFields';
import { z } from 'zod';

type ObjectMeta = {
  properties?: string[];
};

type FieldMeta = {
  hidden?: boolean;
  readOnly?: boolean;
  typeName?: string;
};

type UnionMeta = FieldMeta & {
  selectorLabel?: string;
  unselectedLabel?: string;
  hideSelector?: boolean;
  readOnlySelector?: boolean;
};

const getObjectProperties = (schema: z.ZodTypeAny) =>
  (getMeta(schema, 'object') as ObjectMeta | undefined)?.properties;

const getObjectField = (schema: z.ZodObject<z.ZodRawShape>, key: string) =>
  schema.shape[key] as z.ZodTypeAny;

const isHiddenField = (schema: z.ZodTypeAny) => {
  const meta = getMeta(schema) as FieldMeta | undefined;
  return meta?.hidden === true || meta?.typeName === 'hidden';
};

const isReadOnlyField = (schema: z.ZodTypeAny) => {
  const meta = getMeta(schema) as FieldMeta | undefined;
  return meta?.readOnly === true;
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
      displayName: z.string().register(zf.string.registry, {
        label: 'Display Name',
      }),
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

  it('preserves strict object behavior after hiding fields', () => {
    const schema = z.strictObject({
      name: z.string(),
      secret: z.string().register(zf.string.registry, { label: 'Secret' }),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['secret'],
    });

    expect(
      hiddenSchema.safeParse({
        name: 'Ada',
        secret: 'hidden',
      }).success,
    ).toBe(true);
    expect(
      hiddenSchema.safeParse({
        name: 'Ada',
        secret: 'hidden',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('preserves catchall validation after hiding fields', () => {
    const schema = z
      .object({
        name: z.string(),
        secret: z.string().register(zf.string.registry, { label: 'Secret' }),
      })
      .catchall(z.string());

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['secret'],
    });

    expect(
      hiddenSchema.safeParse({
        name: 'Ada',
        secret: 'hidden',
        extra: 'ok',
      }).success,
    ).toBe(true);
    expect(
      hiddenSchema.safeParse({
        name: 'Ada',
        secret: 'hidden',
        extra: 123,
      }).success,
    ).toBe(false);
  });

  it('preserves array checks after hiding element fields', () => {
    const memberSchema = z.object({
      displayName: z.string().register(zf.string.registry, {
        label: 'Display Name',
      }),
      avatarImage: z
        .string()
        .register(zf.string.registry, { label: 'Avatar' })
        .optional(),
    });

    const schema = z.object({
      members: z.array(memberSchema).min(2).max(2).register(zf.array.registry, {
        label: 'Members',
      }),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['members.avatarImage'],
    });

    expect(
      hiddenSchema.safeParse({
        members: [{ displayName: 'Ada', avatarImage: 'a.png' }],
      }).success,
    ).toBe(false);
    expect(
      hiddenSchema.safeParse({
        members: [
          { displayName: 'Ada', avatarImage: 'a.png' },
          { displayName: 'Bob', avatarImage: 'b.png' },
        ],
      }).success,
    ).toBe(true);

    const hiddenMembers = getObjectField(
      hiddenSchema,
      'members',
    ) as z.ZodArray<z.ZodTypeAny>;
    expect((getMeta(hiddenMembers, 'array') as { label?: string } | undefined)?.label).toBe(
      'Members',
    );
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
    for (const option of hiddenUnion.options as unknown as z.ZodObject<
      z.ZodRawShape
    >[]) {
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
    for (const option of hiddenUnion.options as unknown as z.ZodObject<
      z.ZodRawShape
    >[]) {
      expect(isHiddenField(getObjectField(option, 'secret'))).toBe(true);
    }
  });

  it('keeps union selector metadata visible when only arm fields are hidden', () => {
    const unionSchema = z
      .discriminatedUnion('kind', [
        z.object({
          kind: z.literal('alpha'),
          secret: z.string().register(zf.string.registry, { label: 'Secret' }),
        }),
        z.object({
          kind: z.literal('beta'),
          secret: z.string().register(zf.string.registry, { label: 'Secret' }),
        }),
      ])
      .register(zf.union.registry, {
        selectorLabel: '種類',
        unselectedLabel: '未選択',
      });

    const hiddenUnion = hideSchemaFields(unionSchema, {
      paths: ['secret'],
    });
    const unionMeta = getMeta(hiddenUnion, 'union') as UnionMeta | undefined;

    expect(unionMeta?.selectorLabel).toBe('種類');
    expect(unionMeta?.unselectedLabel).toBe('未選択');
    expect(unionMeta?.hidden).not.toBe(true);
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

  it('ignores unknown paths', () => {
    const schema = z.object({
      name: z.string(),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['missing'],
    });

    expect(hiddenSchema).toBe(schema);
  });

  it('ignores paths that try to traverse into a leaf field', () => {
    const schema = z.object({
      name: z.string(),
    });

    const hiddenSchema = hideSchemaFields(schema, {
      paths: ['name.first'],
    });

    expect(hiddenSchema).toBe(schema);
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

    expect(getObjectField(hiddenSchema, 'profile')).toBe(
      getObjectField(schema, 'profile'),
    );
    expect(isHiddenField(getObjectField(hiddenSchema, 'note'))).toBe(true);
  });

  it('keeps fields inside array elements', () => {
    const memberSchema = z.object({
      displayName: z.string().register(zf.string.registry, {
        label: 'Display Name',
      }),
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

  it('marks union selector as hidden for except mode while preserving visible paths', () => {
    const unionSchema = z
      .discriminatedUnion('kind', [
        z.object({
          kind: z.literal('alpha'),
          versionLabel: z.string().register(zf.string.registry, {
            label: 'Version Label',
          }),
          secret: z.string().register(zf.string.registry, { label: 'Secret' }),
        }),
        z.object({
          kind: z.literal('beta'),
          versionLabel: z.string().register(zf.string.registry, {
            label: 'Version Label',
          }),
          secret: z.string().register(zf.string.registry, { label: 'Secret' }),
        }),
      ])
      .register(zf.union.registry, {
        selectorLabel: '種類',
      });

    const hiddenUnion = hideSchemaFieldsExcept(unionSchema, {
      paths: ['versionLabel'],
    });
    const unionMeta = getMeta(hiddenUnion, 'union') as UnionMeta | undefined;

    expect(isHiddenField(hiddenUnion)).toBe(false);
    expect(unionMeta?.hideSelector).toBe(true);
    for (const option of hiddenUnion.options as unknown as z.ZodObject<
      z.ZodRawShape
    >[]) {
      expect(isHiddenField(getObjectField(option, 'versionLabel'))).toBe(false);
      expect(isHiddenField(getObjectField(option, 'secret'))).toBe(true);
    }
  });

  it('hides all fields when no visible path matches', () => {
    const schema = z.object({
      name: z.string().register(zf.string.registry, { label: 'Name' }),
    });

    const hiddenSchema = hideSchemaFieldsExcept(schema, {
      paths: ['missing'],
    });

    expect(isHiddenField(getObjectField(hiddenSchema, 'name'))).toBe(true);
  });

  it('ignores paths that try to traverse into a leaf field', () => {
    const schema = z.object({
      name: z.string(),
    });

    const hiddenSchema = hideSchemaFieldsExcept(schema, {
      paths: ['name.first'],
    });

    expect(hiddenSchema).toBe(schema);
  });
});

describe('readOnlySchemaFieldsExcept', () => {
  it('marks discriminated union selector as readOnly while preserving selector meta', () => {
    const unionSchema = z
      .discriminatedUnion('kind', [
        z.object({
          kind: z.literal('alpha'),
          versionLabel: z.string().register(zf.string.registry, {
            label: 'Version Label',
          }),
          secret: z.string().register(zf.string.registry, { label: 'Secret' }),
        }),
        z.object({
          kind: z.literal('beta'),
          versionLabel: z.string().register(zf.string.registry, {
            label: 'Version Label',
          }),
          secret: z.string().register(zf.string.registry, { label: 'Secret' }),
        }),
      ])
      .register(zf.union.registry, {
        selectorLabel: '種類',
        unselectedLabel: '未選択',
      });

    const readOnlyUnion = readOnlySchemaFieldsExcept(unionSchema, {
      paths: ['versionLabel'],
    });
    const unionMeta = getMeta(readOnlyUnion, 'union') as UnionMeta | undefined;

    expect(unionMeta?.selectorLabel).toBe('種類');
    expect(unionMeta?.unselectedLabel).toBe('未選択');
    expect(unionMeta?.readOnly).not.toBe(true);
    expect(unionMeta?.readOnlySelector).toBe(true);

    for (const option of readOnlyUnion.options as unknown as z.ZodObject<
      z.ZodRawShape
    >[]) {
      expect(isReadOnlyField(getObjectField(option, 'versionLabel'))).toBe(false);
      expect(isReadOnlyField(getObjectField(option, 'secret'))).toBe(true);
    }
  });

  it('restores date meta to the unwrapped schema', () => {
    const schema = z.object({
      createdAt: zf
        .date()
        .register(zf.date.registry, {
          label: '着信日時',
        })
        .optional(),
      isChecked: zf.boolean().register(zf.boolean.registry, {
        label: '対応状態',
      }),
    });

    const result = readOnlySchemaFieldsExcept(schema, { paths: ['isChecked'] });
    const createdAtSchema = result.shape.createdAt;

    expect(createdAtSchema).toBeInstanceOf(z.ZodOptional);
    expect(getMeta(createdAtSchema)).toBeUndefined();
    expect(getMeta(createdAtSchema.unwrap())).toMatchObject({
      typeName: 'date',
      label: '着信日時',
      readOnly: true,
    });
  });
});
