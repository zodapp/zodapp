/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import z from "zod";
import { extendEnum, extendLiteral, extendString, extendUnion, extendCustom } from ".";

describe("zod-extendable (slim)", () => {
  describe("extendCustom", () => {
    const zfString = extendCustom(z.string, "string");

    it("creates a factory with registry", () => {
      expect(typeof zfString).toBe("function");
      expect(zfString.registry).toBeDefined();
    });

    it("preserves original behavior", () => {
      const schema = zfString();
      expect(schema).toBeInstanceOf(z.ZodString);
      expect(schema.parse("ok")).toBe("ok");
      expect(() => schema.parse(1)).toThrow();
    });

    it("registers metadata", () => {
      const schema = zfString().register(zfString.registry, { uiType: "text" });
      expect(zfString.registry.get(schema)).toEqual({
        typeName: "string",
        uiType: "text",
      });
    });
  });

  describe("extendString/extendEnum", () => {
    const zfLiteral = extendLiteral();
    const zfString = extendString();
    const zfEnum = extendEnum();

    it("creates enum from literals and keeps order", () => {
      const admin = z.literal("admin").register(zfLiteral.registry, {
        label: "管理者",
      });
      const user = z.literal("user").register(zfLiteral.registry, {
        label: "一般",
      });

      const schema = zfEnum([admin, user] as const);
      expect(schema).toBeInstanceOf(z.ZodEnum);
      expect(schema.options).toEqual(["admin", "user"]);
      expect(schema.parse("admin")).toBe("admin");
      expect(() => schema.parse("guest")).toThrow();

      const meta = (zfEnum as any).registry.get(schema);
      expect(meta?.schemas).toBeDefined();
      expect(meta?.schemas?.admin).toBe(admin);
      expect(meta?.schemas?.user).toBe(user);

      // literal meta should be reachable
      expect(zfLiteral.registry.get(admin)).toEqual({
        typeName: "literal",
        label: "管理者",
      });

      // string registry should reject non-string schemas at type level
      // @ts-expect-error registering number meta onto a string registry should fail
      z.number().register(zfString.registry, { label: "nope" });
    });

    it("merges enum-level meta", () => {
      const admin = z.literal("admin");
      const schema = zfEnum([admin] as const).register(
        (zfEnum as any).registry,
        {
          label: "ロール",
        },
      );
      const meta = (zfEnum as any).registry.get(schema);
      expect(meta?.label).toBe("ロール");
      expect(meta?.schemas?.admin).toBe(admin);
    });
  });

  describe("extendUnion", () => {
    const zfUnion = extendUnion();

    it("preserves z.union generic inference", () => {
      const schema = zfUnion([z.string(), z.number()] as const);

      // 型推論が潰れていないこと（string | number になること）
      type T = z.infer<typeof schema>;
      const ok1: T = "a";
      const ok2: T = 1;
      expect(ok1).toBe("a");
      expect(ok2).toBe(1);

      // @ts-expect-error boolean is not assignable to string | number
      const _ng: T = true;

      // 実行時の挙動も確認
      expect(schema.parse("x")).toBe("x");
      expect(schema.parse(123)).toBe(123);
      expect(() => schema.parse(true)).toThrow();
    });
  });
});
