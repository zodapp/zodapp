import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  addOuter,
  emptinessOf,
  innerDefaultValue,
  rewrapWithOuter,
} from "./outer";

/** 包みの部品と同じ順で、外から内へ outer と defaultValue を運び、一番内側に届く値を返す */
const relay = (schema: z.ZodTypeAny) => {
  let outer = undefined as ReturnType<typeof addOuter> | undefined;
  let defaultValue: unknown = undefined;
  let current = schema;
  for (;;) {
    const type = current.def.type;
    if (!["optional", "nullable", "default", "prefault"].includes(type)) break;
    const next = addOuter(outer, current);
    defaultValue = innerDefaultValue(defaultValue, current, next);
    outer = next;
    current = (current.def as unknown as { innerType: z.ZodTypeAny }).innerType;
  }
  return { outer, defaultValue };
};

describe("outer", () => {
  describe("defaultValue の決まり", () => {
    it.each([
      ["default の外に nullable", z.string().default("x").nullable(), "x"],
      ["nullable の外に default", z.string().nullable().default("x"), "x"],
      ["nullable だけ", z.string().nullable(), null],
      ["optional だけ", z.string().optional(), undefined],
      ["optional の外に nullable", z.string().optional().nullable(), undefined],
    ])("%s", (_, schema, expected) => {
      expect(relay(schema).defaultValue).toBe(expected);
      // zod が undefined を受けたときの値と同じ（nullable だけの欄は、フォームの初期値として null）
      if (expected !== null) expect(schema.parse(undefined)).toBe(expected);
    });
  });

  it("emptinessOf：nullable だけなら空は null、optional なら undefined", () => {
    expect(emptinessOf(relay(z.string().nullable()).outer).emptyValue).toBe(
      null,
    );
    expect(
      emptinessOf(relay(z.string().nullable().optional()).outer).emptyValue,
    ).toBe(undefined);
    expect(emptinessOf(undefined)).toEqual({
      optional: false,
      nullable: false,
      emptyValue: undefined,
    });
  });

  it("addOuter は同じ outer と schema なら同じ object を返す", () => {
    const schema = z.string().optional();
    expect(addOuter(undefined, schema)).toBe(addOuter(undefined, schema));
    const plain = z.string();
    const outer = addOuter(undefined, schema);
    expect(addOuter(outer, plain)).toBe(outer);
  });

  it("rewrapWithOuter：包みと、包みの内外に付いた検査を同じ順で付け直す", () => {
    const own = z.string().refine((v) => v !== "own", "own");
    const field = own.optional().refine((v) => v !== "wrap", "wrap");
    const outer = addOuter(undefined, field);
    const schema = rewrapWithOuter(z.string().min(1, "inner"), own, outer);
    expect(schema.safeParse(undefined).success).toBe(true);
    const messages = (value: unknown) =>
      schema.safeParse(value).error?.issues.map((issue) => issue.message);
    expect(messages("")).toEqual(["inner"]);
    expect(messages("own")).toEqual(["own"]);
    expect(messages("wrap")).toEqual(["wrap"]);
    expect(messages("ok")).toBeUndefined();
  });
});
