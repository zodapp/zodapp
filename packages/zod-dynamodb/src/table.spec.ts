import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { tasks, appTable } from "./__fixtures__/tasks";
import { DefinitionError } from "./errors";
import { tableConfig, type ItemOf, type TableKey } from "./table";
import type { PatchOf } from "./types";
import { defineContext } from "./register";

const { createOps } = defineContext<any>();

describe("tableConfig", () => {
  it("受け取ったSchemaをそのまま返す", () => {
    const create = tasks.create;
    expectTypeOf(create.options).not.toBeAny();
    expect(create.options).toHaveLength(2);
    expectTypeOf(
      tasks.item.def.right.shape.createdAt,
    ).toEqualTypeOf<z.ZodDate>();
  });

  it("キーの型はキーのフィールドのPick", () => {
    expectTypeOf<TableKey<typeof tasks>>().toEqualTypeOf<{
      workspaceId: string;
      taskId: string;
    }>();
  });

  it("部分更新の型はvariantごとのPartial", () => {
    type Patch = PatchOf<ItemOf<typeof tasks>>;
    expectTypeOf<{ status: "done" }>().toExtend<Patch>();
    expectTypeOf<{ dueDate: Date }>().toExtend<Patch>();
  });

  it("作成の入力とフックでitemを満たせればcheckがtrueになる", () => {
    expectTypeOf(tasks.$createCheck).toEqualTypeOf<true>();
    const broken = tableConfig({
      table: appTable,
      entity: "Broken",
      item: z.object({
        id: z.string(),
        title: z.string(),
        updatedAt: z.date(),
      }),
      create: z.object({ title: z.string() }),
      key: { partition: ["id"] },
    });
    expectTypeOf(broken.$createCheck).not.toEqualTypeOf<true>();
  });

  it("キーやIndexのフィールドを型で検査する", () => {
    const item = z.object({ id: z.string(), tags: z.array(z.string()) });
    expect(() =>
      tableConfig({
        table: appTable,
        entity: "A",
        item,
        create: item,
        // @ts-expect-error 存在しないフィールド
        key: { partition: ["nope"] },
      }),
    ).toThrow(DefinitionError);
    expect(() =>
      tableConfig({
        table: appTable,
        entity: "B",
        item,
        create: item,
        // @ts-expect-error キーにできない型
        key: { partition: ["tags"] },
      }),
    ).toThrow(DefinitionError);
    expect(() =>
      tableConfig({
        table: appTable,
        entity: "C",
        item,
        create: item,
        key: { partition: ["id"] },
        // @ts-expect-error 存在しないスロット
        indexes: { x: { slot: "GSI9", partition: ["id"] } },
      }),
    ).toThrow(DefinitionError);
  });

  it("一部のvariantにしかないフィールドはベーステーブルのキーにできない", () => {
    const item = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a"), id: z.string(), x: z.string() }),
      z.object({ kind: z.literal("b"), id: z.string() }),
    ]);
    expect(() =>
      tableConfig({
        table: appTable,
        entity: "D",
        item,
        create: item,
        // @ts-expect-error variantにより存在しない
        key: { partition: ["x"] },
      }),
    ).toThrow(DefinitionError);
    // Indexには使える（sparse index）
    expect(() =>
      tableConfig({
        table: appTable,
        entity: "D",
        item,
        create: item,
        key: { partition: ["id"] },
        indexes: { byX: { slot: "GSI1", partition: ["x"] } },
      }),
    ).not.toThrow();
  });

  it("判別用のフィールドをキーにしても、すべてのvariantのキーを検証できる", () => {
    const item = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a"), id: z.string() }),
      z.object({ kind: z.literal("b"), id: z.string(), x: z.int() }),
    ]);
    const t = tableConfig({
      table: appTable,
      entity: "K",
      item,
      create: item,
      key: { partition: ["kind", "id"] },
    });
    expect(
      t._compiled.keySchema.safeParse({ kind: "a", id: "1" }).success,
    ).toBe(true);
    expect(
      t._compiled.keySchema.safeParse({ kind: "b", id: "1" }).success,
    ).toBe(true);
    expect(
      t._compiled.keySchema.safeParse({ kind: "c", id: "1" }).success,
    ).toBe(false);
  });

  it("定義時の実行時検査", () => {
    const item = z.object({
      id: z.string(),
      o: z.string().optional(),
      PK1: z.string(),
    });
    const base = {
      table: appTable,
      item,
      create: item,
      key: { partition: ["id"] as const },
    };
    expect(() => tableConfig({ ...base, entity: "a#b" })).toThrow(/entity/);
    // 予約名との衝突
    expect(() => tableConfig({ ...base, entity: "E" })).toThrow(/reserved/);
    const ok = z.object({
      id: z.string(),
      o: z.string().optional(),
      n: z.string(),
    });
    // optional はベーステーブルのキーにできない
    expect(() =>
      tableConfig({
        table: appTable,
        item: ok,
        create: ok,
        entity: "E",
        // @ts-expect-error optional はキーにできない
        key: { partition: ["o"] },
      }),
    ).toThrow(/optional/);
    // 同じスロットを二度使えない
    expect(() =>
      tableConfig({
        table: appTable,
        item: ok,
        create: ok,
        entity: "E",
        key: { partition: ["id"] },
        indexes: {
          a: { slot: "GSI1", partition: ["n"] },
          b: { slot: "GSI1", partition: ["o"] },
        },
      }),
    ).toThrow(/already used/);
  });

  it("出力をもう一度通せない Schema（transform・pipe・preprocess）はキー以外でもエラー", () => {
    const def = (fields: Record<string, z.ZodType>) => {
      const item = z.object({ id: z.string(), ...fields });
      return () =>
        tableConfig({
          table: appTable,
          entity: "R",
          item,
          create: item,
          key: { partition: ["id"] as const },
        });
    };
    const message = /output must parse again as input/;
    expect(def({ d: z.string().transform((s) => new Date(s)) })).toThrow(
      message,
    );
    expect(def({ d: z.string().pipe(z.coerce.number()) })).toThrow(message);
    expect(def({ d: z.preprocess((v) => String(v), z.string()) })).toThrow(
      message,
    );
    // optional・array・union・object の中も見る
    expect(
      def({
        d: z
          .string()
          .transform((s) => s.length)
          .optional(),
      }),
    ).toThrow(/field "d"/);
    expect(def({ d: z.array(z.string().transform((s) => s.length)) })).toThrow(
      /field "d\[\]"/,
    );
    expect(
      def({ d: z.union([z.number(), z.string().transform(Number)]) }),
    ).toThrow(message);
    expect(def({ d: z.object({ e: z.string().transform(Number) }) })).toThrow(
      /field "d.e"/,
    );
    // create だけにある場合も
    const item = z.object({ id: z.string(), n: z.number() });
    expect(() =>
      tableConfig({
        table: appTable,
        entity: "R",
        item,
        create: z.object({ id: z.string(), n: z.string().transform(Number) }),
        key: { partition: ["id"] as const },
      }),
    ).toThrow(/entity "R" create/);
    // default・coerce・catch は通る
    expect(
      def({
        d: z.string().default(() => "x"),
        n: z.coerce.number(),
        c: z.number().catch(0),
        t: z.string().trim(),
      }),
    ).not.toThrow();
  });

  it("操作の params も確かめる", () => {
    expect(() =>
      createOps(tasks, (o) => ({
        bad: o.mutation({
          params: z.object({ n: z.string().transform(Number) }),
          patch: () => ({}),
        }),
      })),
    ).toThrow(/operation "bad" params/);
  });
});

describe("o.query", () => {
  const queries = createOps(tasks, (o) => ({
    byStatus: o.query({
      index: "byStatus",
      params: z.object({
        workspaceId: z.string(),
        status: z.enum(["todo", "doing", "done"]),
        minPriority: z.int(),
      }),
      where: (p) => ({
        partition: { workspaceId: p.workspaceId, status: p.status },
        sort: { priority: { gte: p.minPriority } },
      }),
      direction: "desc",
    }),
    byAssignee: o.query({
      index: "byAssignee",
      params: z.object({
        workspaceId: z.string(),
        assignee: z.string().nullable(),
      }),
      select: "projection",
      where: (p) => ({
        partition: { workspaceId: p.workspaceId, assignee: p.assignee },
      }),
    }),
    all: o.query({
      params: z.object({ workspaceId: z.string() }),
      where: (p) => ({ partition: { workspaceId: p.workspaceId } }),
    }),
  }));

  it("名前が付く", () => {
    expect(queries.byStatus.name).toBe("byStatus");
  });

  it("結果の型はIndexに載るvariantだけ", () => {
    type R = (typeof queries.byStatus)["$result"];
    expectTypeOf<R["kind"]>().toEqualTypeOf<"todo">();
    type P = (typeof queries.byAssignee)["$result"];
    expectTypeOf<keyof P>().toEqualTypeOf<
      "workspaceId" | "taskId" | "assignee" | "updatedAt"
    >();
  });

  it("Sort Keyの先頭を飛ばした条件はコンパイルエラー", () => {
    createOps(tasks, (o) => ({
      bad: o.query({
        index: "byStatus",
        params: z.object({}),
        where: () => ({
          partition: { workspaceId: "w", status: "todo" },
          // @ts-expect-error priority を飛ばしている
          sort: { updatedAt: new Date() },
        }),
      }),
    }));
  });

  it("物理キーの条件に変換する", () => {
    const cond = queries.byStatus.condition(
      { workspaceId: "acme corp", status: "todo", minPriority: 3 },
      undefined,
    );
    expect(cond).toEqual({
      indexName: "byStatus",
      slot: "GSI1",
      pk: "Task#acme$Pcorp#todo",
      sk: { op: "between", low: "Task#$*c008000000000000", high: "Task#$+" },
      eq: "Task",
    });
  });

  it("数値の範囲条件は、数値の型の範囲に限る", () => {
    const cond = (minPriority: number) =>
      queries.byStatus.condition(
        { workspaceId: "w", status: "todo", minPriority },
        undefined,
      ).sk;
    expect(cond(-1)).toEqual({
      op: "between",
      low: "Task#$*400fffffffffffff",
      high: "Task#$+",
    });
    expect(cond(2.5)).toEqual({
      op: "between",
      low: "Task#$*c004000000000000",
      high: "Task#$+",
    });
  });

  it("所属判定", () => {
    const doc = {
      workspaceId: "w",
      taskId: "t",
      kind: "todo",
      title: "x",
      status: "todo",
      assignee: null,
      priority: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const p = { workspaceId: "w", status: "todo" as const, minPriority: 3 };
    expect(queries.byStatus.matches(doc, p, undefined)).toBe(true);
    expect(
      queries.byStatus.matches({ ...doc, priority: 2 }, p, undefined),
    ).toBe(false);
    expect(
      queries.byStatus.matches({ ...doc, status: "done" }, p, undefined),
    ).toBe(false);
    expect(
      queries.byAssignee.matches(
        doc,
        { workspaceId: "w", assignee: null },
        undefined,
      ),
    ).toBe(true);
    const milestone = {
      workspaceId: "w",
      taskId: "m",
      kind: "milestone",
      title: "m",
      dueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(queries.byStatus.matches(milestone, p, undefined)).toBe(false);
  });
});
