import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { extractSchemaColumns } from "./extract-schema-columns";
import { getDefaultOrderEntries } from "./default-column-order";

describe("getDefaultOrderEntries", () => {
  it("uses defaultFieldPaths order for default columns", () => {
    const schema = z.object({
      manage: zf.string().register(zf.string.registry, { label: "管理" }),
      statusLabel: zf.string().register(zf.string.registry, { label: "状態" }),
      id: zf.string().register(zf.string.registry, { label: "ID" }),
      updatedAt: zf.string().register(zf.string.registry, { label: "更新日時" }),
      versionDescription: zf
        .string()
        .register(zf.string.registry, { label: "バージョン説明" }),
    });

    const defaultFieldPaths = [
      "statusLabel",
      "manage",
      "id",
      "updatedAt",
      "versionDescription",
    ];
    const schemaColumns = extractSchemaColumns(schema, { defaultFieldPaths });

    expect(
      getDefaultOrderEntries(schemaColumns, defaultFieldPaths).map(
        (column) => column.fieldPath,
      ),
    ).toEqual(defaultFieldPaths);
  });

  it("falls back to schema order when defaultFieldPaths is omitted", () => {
    const schema = z.object({
      first: zf.string().register(zf.string.registry, { label: "1つ目" }),
      second: zf.string().register(zf.string.registry, { label: "2つ目" }),
      third: zf.string().register(zf.string.registry, { label: "3つ目" }),
    });

    const schemaColumns = extractSchemaColumns(schema);

    expect(getDefaultOrderEntries(schemaColumns).map((column) => column.fieldPath))
      .toEqual(["first", "second", "third"]);
  });
});
