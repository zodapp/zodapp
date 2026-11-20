import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { zf } from "@zodapp/zod-form";
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
      expect(!parsed.success && parsed.issues[0]!.code).toBe(
        ASYNC_VALIDATION_ISSUE_CODE,
      );
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

describe("FormRuntime.evaluate：検証と送信を同じ評価で行う", () => {
  /** validate が issue を返さないことと、parse が通ることが一致する */
  const expectAgreement = (
    runtime: FormRuntime,
    schema: z.ZodTypeAny,
    value: unknown,
  ) => {
    const issues = runtime.validate(schema, value);
    const parsed = runtime.parse(schema, value);
    expect(parsed.success).toBe(issues.length === 0);
    if (!parsed.success) expect(parsed.issues).toEqual(issues);
    return { issues, parsed };
  };
  const messages = (issues: { path: PropertyKey[]; message: string }[]) =>
    issues.map((issue) => [issue.path.join("."), issue.message]);

  it("親の refine は、変換した dynamic の output を受け取る", () => {
    const runtime = new FormRuntime();
    runtime.set("a", 0, {
      status: "resolved",
      schema: z.string().transform(Number),
    });
    const schema = z
      .object({ a: zf.dynamic(), b: z.number() })
      .refine((v) => typeof v.a === "number" && v.a < v.b, "a < b");

    const ok = expectAgreement(runtime, schema, { a: "3", b: 5 });
    expect(ok.issues).toEqual([]);
    expect(ok.parsed).toEqual({ success: true, data: { a: 3, b: 5 } });

    const ng = expectAgreement(runtime, schema, { a: "7", b: 5 });
    expect(messages(ng.issues)).toEqual([["", "a < b"]]);
  });

  it("path で dynamic の欄を指す親の refine のエラーを、その欄に出す", () => {
    const runtime = new FormRuntime();
    runtime.set("a", 0, { status: "resolved", schema: z.string() });
    const schema = z
      .object({ a: zf.dynamic(), b: z.string() })
      .refine((v) => v.a === v.b, { message: "mismatch", path: ["a"] });

    const { issues } = expectAgreement(runtime, schema, { a: "x", b: "y" });
    expect(messages(issues)).toEqual([["a", "mismatch"]]);
  });

  it("dynamic の中の dynamic：外側の schema の refine は、内側の output を受け取る", () => {
    const runtime = new FormRuntime();
    runtime.set("outer", 0, {
      status: "resolved",
      schema: z
        .object({ inner: zf.dynamic() })
        .refine((v) => v.inner === 10, "inner must be 10"),
    });
    runtime.set("outer.inner", 0, {
      status: "resolved",
      schema: z.string().transform((v) => Number(v) * 10),
    });
    const schema = z.object({ outer: zf.dynamic() });

    const ok = expectAgreement(runtime, schema, { outer: { inner: "1" } });
    expect(ok.parsed).toEqual({
      success: true,
      data: { outer: { inner: 10 } },
    });
    const ng = expectAgreement(runtime, schema, { outer: { inner: "2" } });
    expect(messages(ng.issues)).toEqual([["outer", "inner must be 10"]]);
  });

  it.each([
    [
      "通らない",
      { status: "resolved", schema: z.string().min(3, "short") } as const,
      [["a", "short"]],
    ],
    [
      "読み込み中の",
      { status: "pending" } as const,
      [["a", "zodFormReact.dynamic.loading" /* i18n: 読み込み中 */]],
    ],
    [
      "取得に失敗した",
      { status: "error", error: new Error("x"), retry: () => {} } as const,
      [["a", "zodFormReact.dynamic.failed" /* i18n: 取得できませんでした */]],
    ],
  ])(
    "dynamic が%sときは、親の refine を走らせず、目印の issue も出さない",
    (_name, entry, expected) => {
      const runtime = new FormRuntime();
      runtime.set("a", 0, entry);
      const refine = vi.fn(() => false);
      const schema = z
        .object({ a: zf.dynamic(), b: z.number() })
        .refine(refine, "parent");

      const { issues } = expectAgreement(runtime, schema, { a: "x", b: 1 });
      expect(messages(issues)).toEqual(expected);
      expect(refine).not.toHaveBeenCalled();
    },
  );

  it("配列の要素ごとに違う schema の dynamic を、それぞれの output で評価する", () => {
    const runtime = new FormRuntime();
    runtime.set("items[0]", 0, {
      status: "resolved",
      schema: z.string().transform(Number),
    });
    runtime.set("items[1]", 0, { status: "resolved", schema: z.boolean() });
    const schema = z.object({ items: z.array(zf.dynamic()) });

    const { parsed } = expectAgreement(runtime, schema, {
      items: ["4", true],
    });
    expect(parsed).toEqual({ success: true, data: { items: [4, true] } });
    const ng = expectAgreement(runtime, schema, { items: ["4", "x"] });
    expect(ng.issues.map((issue) => issue.path)).toEqual([["items", 1]]);
  });

  it("union の腕の中の dynamic が通らないとき、目印の issue を invalid_union の中にも残さない", () => {
    const runtime = new FormRuntime();
    runtime.set("v.x", 0, { status: "resolved", schema: z.string().min(3) });
    const schema = z.object({
      v: z.union([z.object({ x: zf.dynamic() }), z.object({ y: z.number() })]),
    });

    const { issues } = expectAgreement(runtime, schema, { v: { x: "a" } });
    const text = JSON.stringify(issues);
    expect(text).not.toContain("dynamicUnresolved");
    expect(issues.some((issue) => issue.path.join(".") === "v.x")).toBe(true);
  });

  it("フォームの値は書き換えない", () => {
    const runtime = new FormRuntime();
    runtime.set("a", 0, { status: "resolved", schema: z.string().min(3) });
    const value = { a: "x" };
    runtime.validate(z.object({ a: zf.dynamic() }), value);
    expect(value).toEqual({ a: "x" });
  });
});
