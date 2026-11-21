import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  PRESENCE_BY_PARENT_OUTER,
  addOuter,
  emptinessOf,
  innerDefaultValue,
  rewrapWithOuter,
} from "./outer";

/** 包みの部品と同じ順で、外から内へ outer と defaultValue を運び、一番内側に届く値を返す */
const relay = (schema: z.ZodTypeAny, start?: ReturnType<typeof addOuter>) => {
  let outer = start;
  let defaultValue: unknown = undefined;
  let current = schema;
  for (;;) {
    const type = current.def.type;
    if (
      ![
        "optional",
        "nullable",
        "default",
        "prefault",
        "nonoptional",
        "readonly",
        "catch",
      ].includes(type)
    )
      break;
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

  describe("nonoptional・readonly・catch", () => {
    it("nonoptional は外側の optional を打ち消し、内側の optional も効かせない", () => {
      expect(relay(z.string().optional().nonoptional()).outer?.optional).toBe(
        false,
      );
      expect(
        relay(z.string().optional().nonoptional().optional()).outer?.optional,
      ).toBe(true);
    });

    it("nonoptional は nullable を残す", () => {
      const { outer } = relay(z.string().nullable().optional().nonoptional());
      expect(outer?.optional).toBe(false);
      expect(outer?.nullable).toBe(true);
    });

    it("dynamic が包み直すとき、nonoptional・readonly・catch も包み直す", () => {
      const { outer } = relay(
        z.string().optional().nonoptional().readonly().catch("c"),
      );
      const rewrapped = rewrapWithOuter(z.number(), undefined, outer);
      expect(rewrapped.parse("x")).toBe("c");
      expect(rewrapped.parse(1)).toBe(1);
      const nonoptional = rewrapWithOuter(
        z.number(),
        undefined,
        relay(z.string().optional().nonoptional()).outer,
      );
      expect(nonoptional.safeParse(undefined).success).toBe(false);
    });
  });

  describe("有る・無いを親が扱う（presenceByParent）", () => {
    // object・partialRecord の entries が、optional の項目の行に渡す
    it.each([
      ["optional", z.string().optional(), false],
      ["default", z.string().default("x"), false],
      ["nullish", z.string().nullish(), true],
      ["optional の外の nullable", z.string().optional().nullable(), true],
    ] as const)(
      "%s は取り消しの UI を出さず、空の値は undefined",
      (_, schema, nullable) => {
        const { outer } = relay(schema, PRESENCE_BY_PARENT_OUTER);
        expect(outer?.optional).toBe(false);
        expect(outer?.nullable).toBe(nullable);
        expect(outer?.presenceByParent).toBe(true);
        // 部品から見ると optional でも nullable でもなく（取り消しの UI を出さない）、空の値は undefined
        expect(emptinessOf(outer)).toEqual({
          optional: false,
          nullable: false,
          emptyValue: undefined,
        });
      },
    );

    it("nullish の欄に、null を初めの値として渡さない", () => {
      const { defaultValue } = relay(
        z.string().nullish(),
        PRESENCE_BY_PARENT_OUTER,
      );
      expect(defaultValue).toBeUndefined();
    });

    it("default の値は、今までどおり内に渡す", () => {
      const { defaultValue } = relay(
        z.string().default("x"),
        PRESENCE_BY_PARENT_OUTER,
      );
      expect(defaultValue).toBe("x");
    });
  });
});
