import z from "zod";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  getMeta,
  zf,
  asRegistrySchemaResolver,
  type ComputedValue,
  type ResolvedSchemaResolver,
  type StringSuggestion,
} from "./index";

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
};
type NumberMeta = CommonMeta & {
  formatter?: (value: number) => ComputedValue;
};
type ObjectMeta = CommonMeta & { properties?: string[] };
type EnumMeta = CommonMeta & {
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

  it("getMeta returns resolved schema resolver", () => {
    const fallback = z.object({ type: z.literal("fallback") });
    const resolved = z.object({
      type: z.literal("resolved"),
    });
    const schema = fallback.register(zf.resolved.registry, {
      label: "Resolved",
      resolve: asRegistrySchemaResolver(() => resolved),
    });

    const meta = getMeta(schema, "resolved");

    expect(meta?.typeName).toBe("resolved");
    expect(meta?.label).toBe("Resolved");
    expect(meta?.resolve(undefined, {})).toBe(resolved);
    expectTypeOf(meta?.resolve).toEqualTypeOf<
      ResolvedSchemaResolver | undefined
    >();
  });
});
