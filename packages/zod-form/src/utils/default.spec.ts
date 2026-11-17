import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getDefaultValue } from "./default";

describe("getDefaultValue", () => {
  it("does not choose a union branch by filling literal values from undefined", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({
        type: z.literal("first"),
        label: z.string(),
      }),
      z.object({
        type: z.literal("second"),
        count: z.number(),
      }),
    ]);

    expect(getDefaultValue(schema)).toBeUndefined();
  });

  it("keeps explicit undefined union branches", () => {
    const schema = z.union([
      z.object({
        type: z.literal("configured"),
        label: z.string(),
      }),
      z.undefined(),
    ]);

    expect(getDefaultValue(schema)).toBeUndefined();
  });

  it("keeps explicit default union branches", () => {
    const schema = z.union([z.string().default("fallback"), z.number()]);

    expect(getDefaultValue(schema)).toBe("fallback");
  });

  it("keeps literal defaults after a branch is already selected", () => {
    const schema = z.object({
      type: z.literal("selected"),
      label: z.string(),
    });

    expect(getDefaultValue(schema)).toStrictEqual({ type: "selected" });
  });

  describe("object：値が undefined になるキーは置かない", () => {
    it("必須の基本型だけの object は {} になる", () => {
      const value = getDefaultValue(z.object({ x: z.string() }));
      expect(value).toStrictEqual({});
      expect("x" in (value as object)).toBe(false);
    });

    it("optional・optional の外に nullable の子もキーを置かない", () => {
      const value = getDefaultValue(
        z.object({
          a: z.string().optional(),
          b: z.number().optional().nullable(),
          c: z.object({ y: z.string() }).optional(),
        }),
      ) as object;
      expect(value).toStrictEqual({});
      expect("a" in value).toBe(false);
      expect("b" in value).toBe(false);
      expect("c" in value).toBe(false);
    });

    it("値のある子はそのまま置き、undefined の子だけ置かない", () => {
      const value = getDefaultValue(
        z.object({
          name: z.string(),
          withDefault: z.string().default("x"),
          nullableOnly: z.string().nullable(),
          list: z.array(z.string()),
          dict: z.record(z.string(), z.number()),
          kind: z.literal("k"),
          nested: z.object({
            inner: z.string(),
            innerDefault: z.boolean().default(true),
          }),
        }),
      ) as Record<string, unknown>;
      // record の {} は null-proto になるので、toEqual と Object.keys で見る
      expect(Object.keys(value).sort()).toEqual(
        [
          "dict",
          "kind",
          "list",
          "nested",
          "nullableOnly",
          "withDefault",
        ].sort(),
      );
      expect(value).toEqual({
        withDefault: "x",
        nullableOnly: null,
        list: [],
        dict: {},
        kind: "k",
        nested: { innerDefault: true },
      });
      expect("name" in value).toBe(false);
      expect("inner" in (value.nested as object)).toBe(false);
    });

    it("object の default の値はそのまま使う", () => {
      const value = getDefaultValue(
        z
          .object({
            a: z.string(),
            b: z.string().default("b"),
            c: z.string().optional(),
          })
          .default({ a: "a", b: "given" }),
      );
      expect(value).toStrictEqual({ a: "a", b: "given" });
    });

    it("キーが無いと検証が変わる子（unknown・any・custom・undefined を含む union）はキーを残す", () => {
      const schema = z.object({
        u: z.unknown(),
        a: z.any(),
        c: z.custom<string>(),
        orUndefined: z.union([z.string(), z.undefined()]),
        s: z.string(),
      });
      const value = getDefaultValue(schema) as object;
      expect(Object.keys(value).sort()).toEqual(
        ["a", "c", "orUndefined", "u"].sort(),
      );
      expect("s" in value).toBe(false);
      // キーを残した子は、キーが無いときの「expected nonoptional」にならない
      const issues = schema.safeParse(value).error?.issues ?? [];
      expect(issues.map((issue) => issue.path.join("."))).toEqual(["s"]);
    });

    it("配列の中の object も undefined のキーを置かない", () => {
      const value = getDefaultValue(
        z.array(z.object({ x: z.string(), y: z.string().nullable() })).min(1),
      );
      expect(value).toStrictEqual([{ y: null }]);
    });
  });

  describe("nullable と default・optional の重なり（zod と同じ値にする）", () => {
    it.each([
      ["default の外に nullable", z.string().default("x").nullable(), "x"],
      ["nullable の外に default", z.string().nullable().default("x"), "x"],
      ["nullable だけ", z.string().nullable(), null],
      ["optional だけ", z.string().optional(), undefined],
      ["optional の外に nullable", z.string().optional().nullable(), undefined],
      ["nullable の外に optional", z.string().nullable().optional(), undefined],
    ])("%s", (_, schema, expected) => {
      expect(getDefaultValue(schema)).toBe(expected);
    });

    it("object の中でも、nullable の中の default を使う", () => {
      const schema = z.object({
        a: z.string().default("x").nullable(),
        b: z.string().nullable(),
      });
      expect(getDefaultValue(schema)).toStrictEqual({ a: "x", b: null });
    });

    it("nullable な object・配列・record は、空の値ではなく null で始める", () => {
      const schema = z.object({
        obj: z.object({ x: z.string() }).nullable(),
        list: z.array(z.string()).nullable(),
        dict: z.record(z.string(), z.string()).nullable(),
      });
      expect(getDefaultValue(schema)).toStrictEqual({
        obj: null,
        list: null,
        dict: null,
      });
    });
  });
});

describe("getDefaultValue に値を渡す（値が無いところだけを補う）", () => {
  it("入っている値は変えず、無いキーだけを既定値で補う", () => {
    const schema = z.object({
      a: z.string().default("x"),
      b: z.number(),
      c: z.string().nullable(),
    });
    expect(getDefaultValue(schema, { b: 1 })).toStrictEqual({
      a: "x",
      b: 1,
      c: null,
    });
    expect(getDefaultValue(schema, { a: "keep", b: 1, c: "y" })).toStrictEqual({
      a: "keep",
      b: 1,
      c: "y",
    });
  });

  it("値が null の欄は null のまま（default も配列の既定値も入れない）", () => {
    const schema = z.object({
      a: z.string().default("x").nullable(),
      list: z.array(z.string()).nullable(),
    });
    expect(getDefaultValue(schema, { a: null, list: null })).toStrictEqual({
      a: null,
      list: null,
    });
  });

  it("配列の各要素の中も補う", () => {
    const schema = z.object({
      items: z.array(
        z.object({ name: z.string(), qty: z.number().default(1) }),
      ),
    });
    expect(
      getDefaultValue(schema, {
        items: [{ name: "a" }, { name: "b", qty: 3 }],
      }),
    ).toStrictEqual({
      items: [
        { name: "a", qty: 1 },
        { name: "b", qty: 3 },
      ],
    });
  });

  it("record の各値の中も補う", () => {
    const schema = z.record(
      z.string(),
      z.object({ on: z.boolean().default(false) }),
    );
    // record は zod-transform が null プロトタイプの object で作るので toEqual で比べる
    expect(getDefaultValue(schema, { k: {} })).toEqual({
      k: { on: false },
    });
  });

  it("値に元からある undefined のキーは残す", () => {
    const schema = z.object({ a: z.string() });
    const value = getDefaultValue(schema, { a: undefined }) as object;
    expect("a" in value).toBe(true);
  });

  it("discriminatedUnion は discriminator の値で腕を選び、入力の途中でも補う", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), x: z.string().default("ax") }),
      z.object({
        type: z.literal("b"),
        name: z.string(),
        y: z.string().default("by"),
      }),
    ]);
    expect(getDefaultValue(schema, { type: "b" })).toStrictEqual({
      type: "b",
      y: "by",
    });
  });

  it("discriminator の無い union も、literal の欄が一致する腕が 1 つなら、その腕で補う", () => {
    const schema = z.union([
      z.object({ kind: z.literal("a"), x: z.string().default("ax") }),
      z.object({
        kind: z.literal("b"),
        name: z.string(),
        y: z.string().default("by"),
      }),
    ]);
    expect(getDefaultValue(schema, { kind: "b" })).toStrictEqual({
      kind: "b",
      y: "by",
    });
  });

  it("腕を決められない union の値は、そのまま残す", () => {
    const schema = z.union([
      z.object({ a: z.string(), x: z.string().default("x") }),
      z.object({ b: z.string(), y: z.string().default("y") }),
    ]);
    const value = { c: 1 };
    expect(getDefaultValue(schema, value)).toBe(value);
  });

  it("optional の中も、値があれば補う", () => {
    const schema = z.object({
      detail: z.object({ n: z.number().default(0), s: z.string() }).optional(),
    });
    expect(getDefaultValue(schema, { detail: {} })).toStrictEqual({
      detail: { n: 0 },
    });
    expect(getDefaultValue(schema, {})).toStrictEqual({});
  });
});
