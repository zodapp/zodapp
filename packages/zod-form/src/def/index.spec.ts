import z from "zod";
import { describe, expect, expectTypeOf, it } from "vitest";
import { getMeta, zf } from "./index";

type CommonMeta = {
  label?: string;
  uiType?: string;
  tags?: string[];
  hidden?: boolean;
  readOnly?: boolean;
  color?: string;
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
    });
    const meta = getMeta(schema);
    expect(meta).toEqual({
      typeName: "string",
      label: "名前",
      uiType: "text",
      tags: ["a"],
    });
    expectTypeOf(meta).toEqualTypeOf<
      ({ typeName: "string" } & CommonMeta) | undefined
    >();
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

  it("returns undefined when schema is not registered or unsupported", () => {
    const plain = zf.string();
    const big = z.bigint();
    expect(getMeta(plain)).toBeUndefined();
    expect(getMeta(big)).toBeUndefined();
  });
});
