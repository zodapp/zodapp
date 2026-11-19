import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getMeta, zf } from "../def";
import { enumeratedRecordKeys, partialRecordKeys } from "./schema";

describe("partialRecordKeys", () => {
  it("キーが enum の partialRecord は、定義順のキーを返す", () => {
    const schema = z.partialRecord(z.enum(["b", "a", "c"]), z.string());
    expect(enumeratedRecordKeys(schema)).toBeUndefined();
    expect(partialRecordKeys(schema)).toEqual(["b", "a", "c"]);
  });

  it("object の形の enum は、値をキーにする", () => {
    const schema = z.partialRecord(
      z.enum({ Small: "s", Large: "l" }),
      z.number(),
    );
    expect(partialRecordKeys(schema)).toEqual(["s", "l"]);
  });

  it("値が複数の literal・literal の union・数値の literal も扱う", () => {
    expect(
      partialRecordKeys(z.partialRecord(z.literal(["x", "y"]), z.string())),
    ).toEqual(["x", "y"]);
    expect(
      partialRecordKeys(
        z.partialRecord(
          z.union([z.literal("x"), z.enum(["y", "z"])]),
          z.string(),
        ),
      ),
    ).toEqual(["x", "y", "z"]);
    expect(
      partialRecordKeys(z.partialRecord(z.literal([1, 2]), z.string())),
    ).toEqual(["1", "2"]);
  });

  it("普通の record・キーが文字列の record・record でない schema は undefined", () => {
    expect(
      partialRecordKeys(z.record(z.enum(["a", "b"]), z.string())),
    ).toBeUndefined();
    expect(partialRecordKeys(z.record(z.string(), z.string()))).toBeUndefined();
    expect(
      partialRecordKeys(z.partialRecord(z.string(), z.string())),
    ).toBeUndefined();
    expect(
      partialRecordKeys(
        z.partialRecord(z.union([z.literal("a"), z.string()]), z.string()),
      ),
    ).toBeUndefined();
    expect(partialRecordKeys(z.object({}))).toBeUndefined();
  });

  it("zf.enum のキーも扱い、選択肢の label は複製されたキーの schema からも読める", () => {
    const keys = zf.enum([
      zf.literal("a").register(zf.literal.registry, { label: "エー" }),
      zf.literal("b").register(zf.literal.registry, { label: "ビー" }),
    ]);
    const schema = z.partialRecord(keys, z.string());
    expect(partialRecordKeys(schema)).toEqual(["a", "b"]);
    const keyType = (schema.def as { keyType: z.ZodTypeAny }).keyType;
    expect(keyType).not.toBe(keys);
    const schemas = (
      getMeta(keyType) as { schemas?: Record<string, z.ZodTypeAny> }
    ).schemas;
    expect(getMeta(schemas!.a!)?.label).toBe("エー");
  });
});
