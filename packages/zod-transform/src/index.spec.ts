import { describe, expect, it } from "vitest";
import z from "zod";

import { $remove, postprocess, preprocess } from ".";

describe("preprocess", () => {
  it("union branch 内の ZodError を branch 不一致として扱い次の branch を試す", () => {
    const objectResponse = z.object({
      type: z.literal("object"),
    });
    const structuredResponse = z.object({
      type: z.literal("structured"),
      fields: z.array(z.object({ kind: z.string() })),
    });

    const schema = z.union([
      z.object({
        agentType: z.literal("ragBot"),
        config: z.object({
          responseSchema: objectResponse.optional(),
        }),
      }),
      z.object({
        agentType: z.literal("flexBot"),
        config: z.object({
          responseSchema: structuredResponse,
        }),
      }),
    ]);
    const payload = {
      agentType: "flexBot",
      config: {
        responseSchema: {
          type: "structured",
          fields: [{ kind: "assistantText" }],
        },
      },
    };

    expect(preprocess(payload, schema)).toEqual(payload);
  });
});

describe("preprocess (z.preprocess の pipe)", () => {
  it("z.preprocess の関数を当ててから、中のスキーマを走査する", () => {
    const tuple = z.tuple([z.string()]);
    const schema = z.object({
      tags: z.preprocess(
        (value) => (Array.isArray(value) ? value.slice(0, 1) : value),
        tuple,
      ),
      other: z.string().optional(),
    });
    expect(preprocess({ tags: ["a", "b", "c"], extra: 1 }, schema)).toEqual({
      tags: ["a"],
      other: undefined,
      extra: 1,
    });
  });

  it("入口が transform でない pipe は、今までどおり入口を走査する", () => {
    const schema = z.string().pipe(z.string().min(1));
    expect(preprocess("x", schema)).toBe("x");
  });
});

describe("intersection", () => {
  const toDate = {
    date: (v: unknown) => (typeof v === "string" ? new Date(v) : v),
  } as never;
  const fromDate = { date: (v: Date) => v.toISOString() };
  const iso = "2026-01-02T03:04:05.000Z";
  const date = new Date(iso);

  it("left だけが知っているキーの変換が残る", () => {
    const schema = z.object({ a: z.date() }).and(z.object({ b: z.string() }));
    expect(preprocess({ a: iso, b: "x" }, schema, toDate)).toEqual({
      a: date,
      b: "x",
    });
    expect(postprocess({ a: date, b: "x" }, schema, fromDate)).toEqual({
      a: iso,
      b: "x",
    });
  });

  it("right だけが知っているキーの変換が残る", () => {
    const schema = z.object({ b: z.string() }).and(z.object({ a: z.date() }));
    expect(preprocess({ a: iso, b: "x" }, schema, toDate)).toEqual({
      a: date,
      b: "x",
    });
    expect(postprocess({ a: date, b: "x" }, schema, fromDate)).toEqual({
      a: iso,
      b: "x",
    });
  });

  it("同じキーの中の別々のフィールドが両方変換される", () => {
    const schema = z
      .object({ meta: z.object({ x: z.date() }) })
      .and(z.object({ meta: z.object({ y: z.date() }) }));
    expect(preprocess({ meta: { x: iso, y: iso } }, schema, toDate)).toEqual({
      meta: { x: date, y: date },
    });
    expect(
      postprocess({ meta: { x: date, y: date } }, schema, fromDate),
    ).toEqual({
      meta: { x: iso, y: iso },
    });
  });

  it("両側が同じキーを同じ規則で変換しても、1 回分の変換になる", () => {
    const schema = z.object({ a: z.date() }).and(z.object({ a: z.date() }));
    expect(postprocess({ a: date }, schema, fromDate)).toEqual({ a: iso });
  });

  it("両側が同じキーを別々の値に変換したら right を採る", () => {
    const schema = z
      .object({ a: z.string() })
      .and(z.object({ a: z.string().describe("r") }));
    const result = postprocess({ a: "x" }, schema, {
      string: (v, s) => (s.description === "r" ? `${v}-right` : `${v}-left`),
    });
    expect(result).toEqual({ a: "x-right" });
  });

  it("片側が $remove したキーを、もう片側が素通ししただけなら取り除く", () => {
    const secret = z.string().describe("secret");
    const strip = {
      string: (v: string, s: z.ZodString) =>
        s.description === "secret" ? $remove() : v,
    } as never;
    const leftRemoves = z
      .object({ s: secret })
      .and(z.object({ b: z.string() }));
    expect(postprocess({ s: "x", b: "y" }, leftRemoves, strip)).toEqual({
      b: "y",
    });
    const rightRemoves = z
      .object({ b: z.string() })
      .and(z.object({ s: secret }));
    expect(postprocess({ s: "x", b: "y" }, rightRemoves, strip)).toEqual({
      b: "y",
    });
  });

  it("left が変換し、right が $remove したら取り除く（right 優先）", () => {
    const schema = z
      .object({ a: z.date() })
      .and(z.object({ a: z.date().describe("drop") }));
    const result = postprocess({ a: date }, schema, {
      date: (v, s) => (s.description === "drop" ? $remove() : v.toISOString()),
    });
    expect(result).toEqual({});
  });

  it("union を含む intersection で、選ばれた選択肢の変換が残る", () => {
    const schema = z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("a"), at: z.date() }),
        z.object({ kind: z.literal("b"), count: z.number() }),
      ])
      .and(z.object({ id: z.string(), createdAt: z.date() }));
    const value = { kind: "a" as const, at: date, id: "1", createdAt: date };
    expect(postprocess(value, schema, fromDate)).toEqual({
      kind: "a",
      at: iso,
      id: "1",
      createdAt: iso,
    });
    expect(
      preprocess(
        { kind: "a", at: iso, id: "1", createdAt: iso },
        schema,
        toDate,
      ),
    ).toEqual(value);
  });

  it("配列の中の intersection で、要素ごとに両側の変換が残る", () => {
    const schema = z.array(
      z.object({ a: z.date() }).and(z.object({ b: z.date() })),
    );
    expect(postprocess([{ a: date, b: date }], schema, fromDate)).toEqual([
      { a: iso, b: iso },
    ]);
  });

  it("intersection の中の配列で、要素ごとに両側の変換が残る", () => {
    const schema = z
      .object({ list: z.array(z.object({ a: z.date() })) })
      .and(z.object({ list: z.array(z.object({ b: z.date() })) }));
    expect(
      postprocess({ list: [{ a: date, b: date }] }, schema, fromDate),
    ).toEqual({
      list: [{ a: iso, b: iso }],
    });
  });

  it("ネストした intersection", () => {
    const schema = z
      .object({ a: z.date() })
      .and(z.object({ b: z.date() }))
      .and(z.object({ c: z.date() }));
    expect(
      postprocess({ a: date, b: date, c: date }, schema, fromDate),
    ).toEqual({
      a: iso,
      b: iso,
      c: iso,
    });
  });

  it("元にないキーを片側が足したら残る", () => {
    const schema = z
      .object({ a: z.string().optional() })
      .describe("add")
      .and(z.object({ b: z.string() }));
    const add = {
      object: (v: Record<string, unknown>, s: z.ZodObject) =>
        s.description === "add" ? { ...v, a: "added" } : v,
    } as never;
    expect(preprocess({ b: "x" }, schema, add)).toEqual({ a: "added", b: "x" });
  });

  it("値が object でなければそのまま返す", () => {
    const schema = z.object({ a: z.string() }).and(z.object({ b: z.string() }));
    expect(preprocess("x", schema)).toBe("x");
    expect(preprocess(null, schema)).toBe(null);
  });
});
