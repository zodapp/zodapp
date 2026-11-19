import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ASYNC_VALIDATION_ISSUE_CODE, FormRuntime } from "./schemaRegistry";

describe("FormRuntime.validate", () => {
  it("keeps the per-arm errors of an invalid_union issue", () => {
    const runtime = new FormRuntime();
    const schema = z.object({ value: z.union([z.string(), z.number()]) });

    const issues = runtime.validate(schema, { value: undefined });

    expect(issues).toHaveLength(1);
    const issue = issues[0] as {
      code?: string;
      path: PropertyKey[];
      errors?: { code: string; path: PropertyKey[] }[][];
    };
    expect(issue.code).toBe("invalid_union");
    expect(issue.path).toEqual(["value"]);
    // 腕ごとの issue。path は union からの相対
    expect(issue.errors).toHaveLength(2);
    expect(issue.errors?.[1]?.[0]).toMatchObject({
      code: "invalid_type",
      path: [],
    });
  });

  it("prefixes the path of issues from a registered schema", () => {
    const runtime = new FormRuntime();
    runtime.set("nested", 0, {
      status: "resolved",
      schema: z.object({ name: z.string().min(3, "short") }),
    });

    const issues = runtime.validate(z.object({ nested: z.unknown() }), {
      nested: { name: "ab" },
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "too_small",
        message: "short",
        path: ["nested", "name"],
      }),
    ]);
  });
});

describe("FormRuntime の既定値の補い（applyDefaultFills）", () => {
  const detail = z.object({
    x: z.string().default("a"),
    items: z.array(z.object({ qty: z.number().default(1) })),
  });

  it("登録が無ければ defaults をそのまま返す", () => {
    const runtime = new FormRuntime();
    const defaults = { detail: { x: "k", items: [] } };
    expect(runtime.applyDefaultFills(defaults)).toBe(defaults);
  });

  it("登録された path を補い、元の defaults は変えない", () => {
    const runtime = new FormRuntime();
    runtime.setDefaultFill("detail", detail);
    const defaults = { detail: { items: [{}] } };
    expect(runtime.applyDefaultFills(defaults)).toEqual({
      detail: { x: "a", items: [{ qty: 1 }] },
    });
    expect(defaults).toEqual({ detail: { items: [{}] } });
  });

  it("値が無ければ既定値を置く。親が無い path や配列の範囲の外には置かない", () => {
    const runtime = new FormRuntime();
    runtime.setDefaultFill("detail", detail);
    runtime.setDefaultFill("missing.detail", detail);
    runtime.setDefaultFill("rows[3].detail", detail);
    expect(runtime.applyDefaultFills({ rows: [{}] })).toEqual({
      rows: [{}],
      detail: { x: "a", items: [] },
    });
  });

  it("補っても変わらなければ defaults をそのまま返す", () => {
    const runtime = new FormRuntime();
    runtime.setDefaultFill("detail", detail);
    const defaults = { detail: { x: "k", items: [{ qty: 2 }] } };
    expect(runtime.applyDefaultFills(defaults)).toBe(defaults);
  });

  it("登録の変化を知らせ、同じ schema の登録だけを外す", () => {
    const runtime = new FormRuntime();
    const listener = vi.fn();
    const unsubscribe = runtime.subscribeDefaultFills(listener);
    runtime.setDefaultFill("detail", detail);
    runtime.setDefaultFill("detail", detail);
    expect(listener).toHaveBeenCalledTimes(1);
    runtime.removeDefaultFill("detail", z.string());
    expect(runtime.applyDefaultFills({})).toEqual({
      detail: { x: "a", items: [] },
    });
    runtime.removeDefaultFill("detail", detail);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(runtime.applyDefaultFills({})).toEqual({});
    unsubscribe();
  });
});

describe("FormRuntime の既定値の補い：作るたびに変わる既定値", () => {
  it("同じ path と値なら、今の値と defaultValues で同じ既定値を使い、登録が増えて計算し直しても変えない", () => {
    let n = 0;
    const schema = z.object({ id: z.string().default(() => `id-${++n}`) });
    const runtime = new FormRuntime();
    runtime.setDefaultFill("a", schema);
    const live = runtime.fillValue("a", schema, undefined);
    const first = runtime.applyDefaultFills({});
    expect(first).toEqual({ a: live });

    runtime.setDefaultFill("b", z.object({ x: z.string().default("x") }));
    const second = runtime.applyDefaultFills({});
    expect(second).toEqual({ a: live, b: { x: "x" } });
  });
});

describe("FormRuntime（非同期の検証）", () => {
  const schemas = [
    ["z.promise()", z.object({ name: z.string(), p: z.promise(z.number()) })],
    [
      "async の refine",
      z.object({ name: z.string() }).refine(async () => true),
    ],
  ] as const;

  for (const [name, schema] of schemas) {
    it(`${name}：例外を握り、ルートの issue にする（console.error は 1 度だけ）`, () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const runtime = new FormRuntime();
      const value = { name: "a", p: Promise.resolve(1) };
      const issues = runtime.validate(schema, value);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.code).toBe(ASYNC_VALIDATION_ISSUE_CODE);
      expect(issues[0]!.path).toEqual([]);
      const parsed = runtime.parse(schema, value);
      expect(parsed.success).toBe(false);
      expect(
        !parsed.success && parsed.issues[0]!.code,
      ).toBe(ASYNC_VALIDATION_ISSUE_CODE);
      expect(error).toHaveBeenCalledTimes(1);
      error.mockRestore();
    });
  }

  it("wrapValidator も例外を投げず、issue を返す", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const runtime = new FormRuntime();
    const validator = runtime.wrapValidator(
      z.object({ p: z.promise(z.number()) }),
    );
    const result = validator["~standard"].validate({
      p: Promise.resolve(1),
    }) as { issues?: unknown[] };
    expect(result.issues).toHaveLength(1);
    vi.restoreAllMocks();
  });
});
