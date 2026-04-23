import { describe, expect, it } from "vitest";
import { zf } from "@zodapp/zod-form";
import { z } from "zod";
import { extractSchemaColumns } from "./extract-schema-columns";

const getFieldPaths = (selectedFieldPaths?: string[]) =>
  extractSchemaColumns(buildPropertiesSchema(), { selectedFieldPaths }).map(
    (column) => column.fieldPath,
  );

function buildPropertiesSchema() {
  const propertySchema = z
    .object({
      name: z.string().register(zf.string.registry, { label: "名前" }),
      key: z.string().register(zf.string.registry, { label: "キー" }),
      names: z
        .array(z.string().register(zf.string.registry, { label: "名前値" }))
        .register(zf.array.registry, {
          label: "名前一覧",
          displayLength: 1,
        }),
    })
    .register(zf.object.registry, {
      properties: ["name", "key", "names"],
    });

  return z.object({
    properties: z.array(propertySchema).register(zf.array.registry, {
      label: "プロパティ",
      displayLength: 1,
    }),
  });
}

describe("extractSchemaColumns", () => {
  it("expands the next outer array index and shows sibling object properties", () => {
    const fieldPaths = getFieldPaths(["properties.0.name"]);

    expect(fieldPaths).toContain("properties.1.name");
    expect(fieldPaths).toContain("properties.1.key");
  });

  it("expands nested arrays only for the selected concrete prefix", () => {
    const fieldPaths = getFieldPaths(["properties.0.names.2"]);

    expect(fieldPaths).toContain("properties.0.names.3");
    expect(fieldPaths).toContain("properties.1.names.0");
    expect(fieldPaths).not.toContain("properties.1.names.3");
  });

  it("keeps nested array prefixes independent from each other", () => {
    const fieldPaths = getFieldPaths([
      "properties.0.names.2",
      "properties.1.names.0",
    ]);

    expect(fieldPaths).toContain("properties.0.names.3");
    expect(fieldPaths).toContain("properties.1.names.1");
    expect(fieldPaths).not.toContain("properties.1.names.2");
  });

  it("does not shrink schemas whose displayLength already exceeds the dynamic cap", () => {
    const schema = z.object({
      tags: z
        .array(z.string().register(zf.string.registry, { label: "タグ" }))
        .register(zf.array.registry, {
          label: "タグ一覧",
          displayLength: 12,
        }),
    });

    const fieldPaths = extractSchemaColumns(schema, {
      selectedFieldPaths: ["tags.15"],
    }).map((column) => column.fieldPath);

    expect(fieldPaths).toContain("tags.11");
    expect(fieldPaths).not.toContain("tags.12");
  });
});

describe("extractSchemaColumns selector labels", () => {
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
