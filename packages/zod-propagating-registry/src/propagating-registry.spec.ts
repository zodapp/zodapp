import { describe, expect, it } from "vitest";
import z from "zod";
import { zodPropagatingRegistry } from "./propagating-registry";

const registryKey = Symbol.for("uir");

describe("zodPropagatingRegistry", () => {
  it("registers meta and answers has/get", () => {
    const registry = zodPropagatingRegistry<{ uiType: string }, z.ZodString>(
      registryKey,
    );
    const schema = z.string().register(registry, { uiType: "password" });

    expect(registry.has(schema)).toBe(true);
    expect(registry.get(schema)).toEqual({ uiType: "password" });
  });

  it("adds fixed meta (e.g. typeName) to get result while keeping register meta unchanged", () => {
    const registry = zodPropagatingRegistry<{ uiType: string }, z.ZodString>(
      registryKey,
      { typeName: "string" } as const,
    );
    const schema = z.string().register(registry, { uiType: "password" });

    expect(registry.get(schema)).toEqual({
      typeName: "string",
      uiType: "password",
    });

    // register 時の meta には fixed meta は含めない（従来通り）
    // @ts-expect-error fixed meta should not be accepted in register meta
    z.string().register(registry, { uiType: "password", typeName: "string" });
  });

  it("propagates meta to derived schemas that shallow-copy _def", () => {
    const registry = zodPropagatingRegistry<{ uiType: string }, z.ZodString>(
      registryKey,
    );
    const original = z.string().register(registry, { uiType: "password" });
    const derived = original
      .max(10)
      .superRefine((_val, _ctx) => {})
      .describe("with meta");

    expect(registry.get(derived)).toEqual({ uiType: "password" });
    expect(registry.get(original)).toEqual({ uiType: "password" });
  });

  it("propagates meta through chained string modifiers like min/refine", () => {
    const registry = zodPropagatingRegistry<{ uiType: string }>(registryKey);
    const base = z.string().register(registry, { uiType: "text" });
    const derived = base.min(3).refine((v) => v.length > 0);
    const transformed = base.transform((v) => v.length);

    expect(registry.get(derived)).toEqual({ uiType: "text" });
    expect(registry.get(base)).toEqual({ uiType: "text" });
    // transform は ZodEffects になり、meta は伝播しない
    expect(registry.get(transformed)).toBeUndefined();
  });

  it("merges meta when registering multiple times", () => {
    const registry = zodPropagatingRegistry<
      { uiType?: string; label?: string },
      z.ZodString
    >(registryKey);
    const schema = z.string();

    registry.add(schema, { uiType: "text" });
    registry.add(schema, { label: "名前" });

    expect(registry.get(schema)).toEqual({ uiType: "text", label: "名前" });
  });

  it("removes meta without affecting other registries", () => {
    const registry = zodPropagatingRegistry<{ uiType?: string }, z.ZodString>(
      registryKey,
    );
    const otherRegistry = zodPropagatingRegistry<
      { hint?: string },
      z.ZodString
    >("other");
    const schema = z.string();

    registry.add(schema, { uiType: "text" });
    otherRegistry.add(schema, { hint: "keep" });
    registry.remove(schema);

    expect(registry.has(schema)).toBe(false);
    expect(registry.get(schema)).toBeUndefined();
    expect(otherRegistry.get(schema)).toEqual({ hint: "keep" });
  });

  it("shares the same meta key when the registry name matches", () => {
    const registryA = zodPropagatingRegistry<{ uiType?: string }, z.ZodString>(
      "shared",
    );
    const registryB = zodPropagatingRegistry<{ uiType?: string }, z.ZodString>(
      "shared",
    );
    const schema = z.string().register(registryA, { uiType: "text" });

    expect(registryB.get(schema)).toEqual({ uiType: "text" });
  });

  it("does not propagate meta through wrapper types", () => {
    const registry = zodPropagatingRegistry<{ uiType: string }>(registryKey);
    const base = z.string().register(registry, { uiType: "text" });

    const optional = base.optional();
    const nullable = base.nullable();
    const defaulted = base.default("fallback");

    expect(registry.get(optional)).toBeUndefined();
    expect(registry.get(nullable)).toBeUndefined();
    expect(registry.get(defaulted)).toBeUndefined();
    expect(registry.get(base)).toEqual({ uiType: "text" });
  });

  it("has correct type inference for register meta", () => {
    const registry = zodPropagatingRegistry<
      { uiType: "text" | "password" },
      z.ZodString
    >(registryKey);
    z.string().register(registry, { uiType: "text" });
    // @ts-expect-error string literal outside union should be rejected
    z.string().register(registry, { uiType: "wrong" });
  });

  it("rejects register calls with mismatched schema type", () => {
    const stringRegistry = zodPropagatingRegistry<
      { uiType: string },
      z.ZodString
    >(registryKey);
    const numberRegistry = zodPropagatingRegistry<
      { step: number },
      z.ZodNumber
    >("number");

    z.string().register(stringRegistry, { uiType: "text" });
    // @ts-expect-error registering number meta onto a string schema should fail
    z.string().register(numberRegistry, { step: 1 });
  });
});

