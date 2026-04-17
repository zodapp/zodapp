import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { extractSchemaColumns } from "./extract-schema-columns";

describe("extractSchemaColumns", () => {
  it("uses selectorLabel for a top-level discriminated union column", () => {
    const schema = z
      .discriminatedUnion("type", [
        z.object({
          type: z
            .literal("simpleBot")
            .register(zf.literal.registry, { label: "シンプルボット", hidden: true }),
          note: z.string().register(zf.string.registry, { label: "メモ" }),
        }),
        z.object({
          type: z
            .literal("ragBot")
            .register(zf.literal.registry, { label: "RAGボット", hidden: true }),
          note: z.string().register(zf.string.registry, { label: "メモ" }),
        }),
      ])
      .register(zf.union.registry, { selectorLabel: "タイプ" });

    const columns = extractSchemaColumns(schema);

    expect(columns.find((column) => column.fieldPath === "type")?.label).toBe("タイプ");
  });

  it("uses selectorLabel for a wrapped nested discriminated union column", () => {
    const aiAgentSchema = z
      .discriminatedUnion("type", [
        z.object({
          type: z
            .literal("simpleBot")
            .register(zf.literal.registry, { label: "シンプルボット", hidden: true }),
          note: z.string().register(zf.string.registry, { label: "メモ" }),
        }),
        z.object({
          type: z
            .literal("ragBot")
            .register(zf.literal.registry, { label: "RAGボット", hidden: true }),
          note: z.string().register(zf.string.registry, { label: "メモ" }),
        }),
      ])
      .register(zf.union.registry, {
        label: "AIエージェント",
        selectorLabel: "タイプ",
      });

    const schema = z.object({
      currentData: aiAgentSchema.optional(),
    });

    const columns = extractSchemaColumns(schema);

    expect(columns.find((column) => column.fieldPath === "currentData.type")?.label).toBe(
      "タイプ",
    );
  });

  it("falls back to the discriminator key when selectorLabel is absent", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({
        type: z.literal("alpha").register(zf.literal.registry, { hidden: true }),
        note: z.string().register(zf.string.registry, { label: "メモ" }),
      }),
      z.object({
        type: z.literal("beta").register(zf.literal.registry, { hidden: true }),
        note: z.string().register(zf.string.registry, { label: "メモ" }),
      }),
    ]);

    const columns = extractSchemaColumns(schema);

    expect(columns.find((column) => column.fieldPath === "type")?.label).toBe("type");
  });
});
