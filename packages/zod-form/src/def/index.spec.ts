import z from "zod";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  getMeta,
  zf,
  asRegistrySchemaResolver,
  defineDynamicMeta,
  type ComputedValue,
  type FnInput,
  type StringSuggestion,
} from "./index";
import type { RegisteredValueActionConfig } from "../valueAction/types";

type CommonMeta = {
  label?: string;
  uiType?: string;
  tags?: string[];
  hidden?: boolean;
  readOnly?: boolean;
  color?: string;
  width?: number;
  widthWeight?: number;
  align?: "left" | "center" | "right";
};
type StringMeta = CommonMeta & {
  formatter?: (value: string) => ComputedValue;
  suggestions?: StringSuggestion[];
  valueAction?: RegisteredValueActionConfig;
};
type NumberMeta = CommonMeta & {
  formatter?: (value: number) => ComputedValue;
};
type ObjectMeta = CommonMeta & { properties?: string[] };
type EnumMeta = CommonMeta & {
  valueAction?: RegisteredValueActionConfig;
  unlisted?: "keep" | "clear";
  emptyMessage?: string;
  schemas?: Record<string, z.ZodLiteral<string>>;
};

describe("zod-form def/index", () => {
  it("getMeta returns common meta for registered primitive", () => {
    const schema = zf.string().register(zf.string.registry, {
      label: "名前",
      uiType: "text",
      tags: ["a"],
      widthWeight: 2,
      align: "center",
    });
    const meta = getMeta(schema);
    expect(meta).toEqual({
      typeName: "string",
      label: "名前",
      uiType: "text",
      tags: ["a"],
      widthWeight: 2,
      align: "center",
    });
    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "string" } & StringMeta) | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    >(undefined as any);
  });

  it("getMeta respects object properties meta (order/pick)", () => {
    const schema = z
      .object({
        name: zf.string().register(zf.string.registry, { label: "名前" }),
        age: zf.number().register(zf.number.registry, { label: "年齢" }),
      })
      .register(zf.object.registry, { properties: ["age"] });
    const meta = getMeta(schema);
    expect(meta).toMatchObject({ properties: ["age"] });
    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "object" } & Partial<ObjectMeta>) | undefined
    >();
  });

  it("enum sugar registers literal schemas and keeps order", () => {
    const admin = z.literal("admin").register(zf.literal.registry, {
      label: "管理者",
    });
    const user = z.literal("user").register(zf.literal.registry, {
      label: "一般",
    });

    const role = zf
      .enum([admin, user] as const)
      .register(zf.enum.registry, { label: "ロール" });

    expect(role.options).toEqual(["admin", "user"]);

    const meta = getMeta(role);
    expect(meta?.label).toBe("ロール");
    expect(meta?.schemas?.admin).toBe(admin);
    expect(meta?.schemas?.user).toBe(user);
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    expect(getMeta(meta?.schemas?.admin!)).toEqual({
      typeName: "literal",
      label: "管理者",
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    expect(getMeta(meta?.schemas?.user!)).toEqual({
      typeName: "literal",
      label: "一般",
    });

    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "enum" } & Partial<EnumMeta>) | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    >(undefined as any);

    expectTypeOf(role).toEqualTypeOf<
      z.ZodEnum<{
        admin: "admin";
        user: "user";
      }>
    >(undefined as any);
  });

  it("getMeta returns formatter for string with formatter", () => {
    const fmt = (v: string) => `+${v}`;
    const schema = zf.string().register(zf.string.registry, {
      label: "電話番号",
      formatter: fmt,
    });
    const meta = getMeta(schema);
    expect(meta?.label).toBe("電話番号");
    expect(meta?.formatter).toBe(fmt);
    expect(meta?.formatter?.("123")).toBe("+123");
    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "string" } & StringMeta) | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    >(undefined as any);
  });

  it("getMeta returns suggestions for string", () => {
    const suggestions: StringSuggestion[] = [
      "draft",
      { label: "Published", value: "published" },
    ];
    const schema = zf.string().register(zf.string.registry, {
      label: "Status",
      suggestions,
    });
    const meta = getMeta(schema);
    expect(meta?.suggestions).toEqual(suggestions);
    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "string" } & StringMeta) | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    >(undefined as any);
  });

  it("getMeta returns no formatter when string is registered without one", () => {
    const schema = zf.string().register(zf.string.registry, {
      label: "名前",
    });
    const meta = getMeta(schema);
    expect(meta?.formatter).toBeUndefined();
  });

  it("getMeta returns formatter for number with formatter", () => {
    const fmt = (v: number) => v.toFixed(3);
    const schema = zf.number().register(zf.number.registry, {
      label: "スコア",
      formatter: fmt,
    });
    const meta = getMeta(schema);
    expect(meta?.label).toBe("スコア");
    expect(meta?.formatter).toBe(fmt);
    expect(meta?.formatter?.(1.5)).toBe("1.500");
    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "number" } & NumberMeta) | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    >(undefined as any);
  });

  it("number formatter can return ComputedValue badge", () => {
    const fmt = (v: number): ComputedValue =>
      v > 0.5
        ? { type: "badge", label: "高", color: "green" }
        : { type: "badge", label: "低", color: "red" };
    const schema = zf.number().register(zf.number.registry, {
      label: "信頼度",
      formatter: fmt,
    });
    const meta = getMeta(schema);
    expect(meta?.formatter?.(0.8)).toEqual({
      type: "badge",
      label: "高",
      color: "green",
    });
    expect(meta?.formatter?.(0.3)).toEqual({
      type: "badge",
      label: "低",
      color: "red",
    });
  });

  it("returns undefined when schema is not registered or unsupported", () => {
    const plain = zf.string();
    const big = z.bigint();
    expect(getMeta(plain)).toBeUndefined();
    expect(getMeta(big)).toBeUndefined();
  });

  it("getMeta returns dynamic schema resolver", () => {
    const fallback = z.object({ type: z.literal("fallback") });
    const dynamic = z.object({
      type: z.literal("dynamic"),
    });
    const schema = fallback.register(zf.dynamic.registry, {
      label: "動的スキーマ",
      resolve: asRegistrySchemaResolver(() => ({
        schema: dynamic,
        key: "dynamic",
      })),
    });

    const meta = getMeta(schema, "dynamic");
    const input: FnInput = {
      value: undefined,
      parent: undefined,
      context: undefined,
    };

    expect(meta?.typeName).toBe("dynamic");
    expect(meta?.label).toBe("動的スキーマ");
    expect(meta?.resolve(input as never)).toEqual({
      schema: dynamic,
      key: "dynamic",
    });
  });

  it("getMeta accepts a { key, load } dynamic schema resolver", async () => {
    const fallback = z.object({ type: z.literal("fallback") });
    const dynamic = z.object({
      type: z.literal("dynamic"),
    });
    const schema = fallback.register(zf.dynamic.registry, {
      resolve: asRegistrySchemaResolver(({ value }) => ({
        key: String(value),
        load: async () => ({ schema: dynamic }),
      })),
    });

    const meta = getMeta(schema, "dynamic");
    const result = meta?.resolve({
      value: "a",
      parent: undefined,
      context: undefined,
    } as never) as { key: string; load: () => Promise<unknown> };

    expect(result.key).toBe("a");
    await expect(result.load()).resolves.toEqual({ schema: dynamic });
  });

  it("resolve は Promise を直接返せない（型で止まる）", () => {
    z.object({}).register(zf.dynamic.registry, {
      // @ts-expect-error 非同期に決まるときは { key, load } を返す
      resolve: asRegistrySchemaResolver(async () => ({
        schema: z.object({}),
        key: "a",
      })),
    });
  });

  it("dynamic の resolve は dependsOnParent: true のときだけ parent を型に入れる", () => {
    zf.dynamic().register(
      zf.dynamic.registry,
      defineDynamicMeta<unknown, { kind: string }>({
        dependsOnParent: true,
        resolve: ({ parent }) => {
          expectTypeOf(parent).toEqualTypeOf<{ kind: string }>();
          return undefined;
        },
      }),
    );
    zf.dynamic().register(
      zf.dynamic.registry,
      defineDynamicMeta({
        resolve: ({ parent }) => {
          expectTypeOf(parent).toEqualTypeOf<undefined>();
          return undefined;
        },
      }),
    );
  });
});

describe("zf.computed は初めから optional", () => {
  const total = zf.computed().register(zf.computed.registry, {
    compute: () => "合計",
  });
  const schema = z.object({ name: z.string(), total });

  it("キーが無くても検証を通す", () => {
    expect(schema.safeParse({ name: "a" }).success).toBe(true);
  });

  it("meta は登録した schema から読める", () => {
    expect(getMeta(total)?.typeName).toBe("computed");
  });

  it("object の型で optional なキーになる", () => {
    expectTypeOf<z.input<typeof schema>>().toEqualTypeOf<{
      name: string;
      total?: undefined;
    }>();
  });
});
