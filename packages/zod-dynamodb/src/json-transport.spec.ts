import { createJsonTransport } from "@zodapp/zod-transport-json";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { tasks } from "./__fixtures__/tasks";
import { endpoint } from "./endpoint";
import { jsonTransport } from "./json-transport";

const at = new Date("2026-01-01T00:00:00.000Z");
const iso = at.toISOString();
const du = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("a"), d: z.date() }),
  z.object({ kind: z.literal("b"), e: z.date() }),
]);
const ts = z.object({ c: z.date() });

describe("intersection を含む Schema の JSON の transport", () => {
  it("zod-transport-json だけでは、左側の Date が変換されない（回避している制約）", () => {
    expect(() =>
      createJsonTransport(ts.and(z.object({ e: z.date() }))).encode({
        c: at,
        e: at,
      }),
    ).toThrow();
  });

  it.each([
    [
      "object と object",
      ts.and(z.object({ e: z.date() })),
      { c: at, e: at },
      { c: iso, e: iso },
    ],
    [
      "object と union",
      ts.and(du),
      { c: at, kind: "b", e: at },
      { c: iso, kind: "b", e: iso },
    ],
    [
      "union と object",
      du.and(ts),
      { kind: "a", d: at, c: at },
      { kind: "a", d: iso, c: iso },
    ],
    [
      "3 つの intersection",
      z.object({ x: z.string() }).and(du).and(ts),
      { x: "1", kind: "b", e: at, c: at },
      { x: "1", kind: "b", e: iso, c: iso },
    ],
    [
      "入れ物の中",
      z.object({ items: z.array(ts.and(du)), item: ts.and(du).nullable() }),
      { items: [{ c: at, kind: "a", d: at }], item: null },
      { items: [{ c: iso, kind: "a", d: iso }], item: null },
    ],
  ] as const)("%s", (_name, schema, value, json) => {
    const t = jsonTransport(schema as z.ZodType);
    expect(t.encode(value)).toEqual(json);
    expect(t.decode(json)).toEqual(value);
  });

  it("エンドポイント：fixture の Task（intersection）の milestone を往復する", () => {
    const e = endpoint.get(tasks, { path: "/x" });
    const item = {
      workspaceId: "w",
      taskId: "t",
      kind: "milestone" as const,
      title: "m",
      dueDate: at,
      createdAt: at,
      updatedAt: at,
    };
    const json = JSON.parse(JSON.stringify(e.encodeOutput({ item }, item)));
    expect(json.item.dueDate).toBe(iso);
    expect(e.decodeOutput(json, item)).toEqual({ item });
  });
});
