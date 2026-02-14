import { describe, expect, it } from "vitest";
import { z } from "zod";

import { decodeSearchParams, encodeSearchParams } from "./searchParams";

const schema = z.object({
  string: z.string(),
  number: z.number(),
  object: z.object({
    string: z.string(),
    array: z.array(z.string()),
    tuple: z.tuple([z.string(), z.number()]),
    date: z.date(),
  }),
  arrayOfString: z.array(z.string()),
  arrayOfNumber: z.array(z.number()),
  arrayOfObject: z.array(
    z.object({
      string: z.string(),
      number: z.number(),
    }),
  ),
});

const srcObj = {
  string: "bar",
  number: 3,
  object: {
    string: "value",
    array: ["s1", "s2"],
    tuple: ["s3", 4] as const,
    date: new Date("2025-03-13T00:52:22.213Z"),
  },
  arrayOfString: ["v1", "v2"],
  arrayOfNumber: [1, 2],
  arrayOfObject: [
    { string: "v3", number: 3 },
    { string: "v4", number: 4 },
  ],
};

const expectedEncodedEntries: Record<string, string> = {
  string: "bar",
  number: "3",
  "object.string": "value",
  "object.array.0": "s1",
  "object.array.1": "s2",
  "object.tuple.0": "s3",
  "object.tuple.1": "4",
  "object.date": "20250313005222213",
  "arrayOfString.0": "v1",
  "arrayOfString.1": "v2",
  "arrayOfNumber.0": "1",
  "arrayOfNumber.1": "2",
  "arrayOfObject.0.string": "v3",
  "arrayOfObject.0.number": "3",
  "arrayOfObject.1.string": "v4",
  "arrayOfObject.1.number": "4",
};

describe("searchParamsUtil", () => {
  it("encodes schema values into URLSearchParams", () => {
    const searchParams = encodeSearchParams(
      srcObj as z.infer<typeof schema>,
      schema,
    );
    const actual = Object.fromEntries(searchParams.entries());
    expect(actual).toEqual(expectedEncodedEntries);
  });

  it("encodes values into URLSearchParams without schema", () => {
    const obj = {
      string: "bar",
      number: 3,
      boolean: true,
      nullValue: null,
      undefinedValue: undefined,
      date: new Date("2025-03-13T00:52:22.213Z"),
      setOfNumber: new Set([1, 2]),
      map: new Map([
        ["feature.flag", "on"],
        ["simple", "off"],
      ]),
      array: ["v1", 2],
    };

    const searchParams = encodeSearchParams(obj);
    const actual = Object.fromEntries(searchParams.entries());

    expect(actual.string).toBe("bar");
    expect(actual.number).toBe("3");
    expect(actual.boolean).toBe("true");
    expect(actual.nullValue).toBe("null");
    expect(actual.undefinedValue).toBeUndefined();
    expect(actual.date).toBe("20250313005222213");
    expect(actual["setOfNumber.0"]).toBe("1");
    expect(actual["setOfNumber.1"]).toBe("2");
    // map keys may contain dots; they must be encoded as %2e
    expect(actual["map.feature%2eflag"]).toBe("on");
    expect(actual["map.simple"]).toBe("off");
    expect(actual["array.0"]).toBe("v1");
    expect(actual["array.1"]).toBe("2");
  });

  it("decodes URLSearchParams back into schema values", () => {
    const searchParams = new URLSearchParams(
      Object.entries(expectedEncodedEntries),
    );

    const restored = decodeSearchParams(searchParams, schema);

    expect(restored.string).toBe("bar");
    expect(restored.number).toBe(3);
    expect(restored.object.string).toBe("value");
    expect(restored.object.array).toEqual(["s1", "s2"]);
    expect(restored.object.tuple).toEqual(["s3", 4]);

    expect(restored.object.date).toBeInstanceOf(Date);
    expect(restored.object.date.getTime()).toBe(
      new Date("2025-03-13T00:52:22.213Z").getTime(),
    );

    expect(restored.arrayOfString).toEqual(["v1", "v2"]);
    expect(restored.arrayOfNumber).toEqual([1, 2]);
    expect(restored.arrayOfObject).toEqual([
      { string: "v3", number: 3 },
      { string: "v4", number: 4 },
    ]);
  });

  it("handles dotted field names when encoding/decoding", () => {
    const dottedSchema = z.object({
      "foo.bar": z.string(),
      nested: z.object({
        "child.with.dot": z.number(),
      }),
    });
    const dottedValue = {
      "foo.bar": "value",
      nested: {
        "child.with.dot": 42,
      },
    };

    const encoded = encodeSearchParams(dottedValue, dottedSchema);
    const entries = Object.fromEntries(encoded.entries());

    expect(entries["foo%2ebar"]).toBe("value");
    expect(entries["nested.child%2ewith%2edot"]).toBe("42");

    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      dottedSchema,
    );

    expect(decoded["foo.bar"]).toBe("value");
    expect(decoded.nested["child.with.dot"]).toBe(42);
  });

  it("round-trips complex container and scalar types", () => {
    const complexSchema = z.object({
      flagTrue: z.boolean(),
      flagFalse: z.boolean(),
      nullableText: z.string().nullable(),
      optionalCount: z.number().optional(),
      bigValue: z.bigint(),
      setOfNumber: z.set(z.number()),
      mapOfDate: z.map(z.string(), z.date()),
      nested: z.object({
        mapWithDotKey: z.map(z.string(), z.string()),
        setOfString: z.set(z.string()),
        tupleMixed: z.tuple([z.boolean(), z.null()]),
      }),
    });

    const complexValue = {
      flagTrue: true,
      flagFalse: false,
      nullableText: null,
      // optionalCount は undefined のまま
      bigValue: BigInt("12345678901234567890"),
      setOfNumber: new Set([1, 2]),
      mapOfDate: new Map([
        ["release", new Date("2025-05-01T12:00:00.000Z")],
        ["deadline", new Date("2025-06-15T00:00:00.000Z")],
      ]),
      nested: {
        mapWithDotKey: new Map([
          ["feature.flag", "on"],
          ["simple", "off"],
        ]),
        setOfString: new Set(["alpha", "beta"]),
        tupleMixed: [true, null] as const,
      },
    };

    const parsed = complexSchema.parse(complexValue);
    const encoded = encodeSearchParams(parsed, complexSchema);
    const entries = Object.fromEntries(encoded.entries());

    expect(entries["optionalCount"]).toBe("undefined");
    expect(entries["nested.mapWithDotKey.feature%2eflag"]).toBe("on");
    expect(entries["mapOfDate.release"]).toBeDefined();

    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      complexSchema,
    );

    expect(decoded.flagTrue).toBe(true);
    expect(decoded.flagFalse).toBe(false);
    expect(decoded.nullableText).toBeNull();
    expect(decoded.optionalCount).toBeUndefined();
    expect(decoded.bigValue).toBe(BigInt("12345678901234567890"));
    expect(decoded.setOfNumber).toEqual(new Set([1, 2]));
    expect(decoded.mapOfDate.get("release")?.getTime()).toBe(
      new Date("2025-05-01T12:00:00.000Z").getTime(),
    );
    expect(decoded.mapOfDate.get("deadline")?.getTime()).toBe(
      new Date("2025-06-15T00:00:00.000Z").getTime(),
    );
    expect(decoded.nested.mapWithDotKey.get("feature.flag")).toBe("on");
    expect(decoded.nested.mapWithDotKey.get("simple")).toBe("off");
    expect(decoded.nested.setOfString).toEqual(new Set(["alpha", "beta"]));
    expect(decoded.nested.tupleMixed).toEqual([true, null]);
  });

  it("preserves empty string keys when encoding/decoding", () => {
    const emptyKeySchema = z.object({
      "": z.string(),
      nested: z.object({
        "": z.number(),
      }),
    });

    const value = {
      "": "root",
      nested: { "": 1 },
    };

    const encoded = encodeSearchParams(value, emptyKeySchema);
    const entries = Object.fromEntries(encoded.entries());

    // Root empty key should remain empty (key is "")
    expect(entries[""]).toBe("root");
    // Nested empty key becomes "nested." (trailing dot = empty segment)
    expect(entries["nested."]).toBe("1");

    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      emptyKeySchema,
    );
    expect(decoded[""]).toBe("root");
    expect(decoded.nested[""]).toBe(1);
  });

  it("omits undefined values while preserving nulls for optionals", () => {
    const optionalSchema = z.object({
      optionalArray: z.array(z.number().optional()),
      nullableArray: z.array(z.number().nullable()),
      nested: z.object({
        maybeUndefined: z.string().optional(),
        maybeNull: z.string().nullable(),
      }),
    });

    const optionalValue = {
      optionalArray: [1, undefined, 3],
      nullableArray: [1, null, 3],
      nested: {
        maybeUndefined: undefined,
        maybeNull: null,
      },
    };
    const parsed = optionalSchema.parse(optionalValue);
    const encoded = encodeSearchParams(parsed, optionalSchema);

    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      optionalSchema,
    );
    expect(decoded).toEqual(parsed);
  });

  it("round-trips catchall keys without dropping dynamic fields", () => {
    const catchallSchema = z
      .object({
        fixed: z.number(),
      })
      .catchall(z.string());

    const catchallValue = {
      fixed: 10,
      dynamicA: "foo",
      dynamicB: "bar",
    };

    const encoded = encodeSearchParams(
      catchallValue as unknown as z.infer<typeof catchallSchema>,
      catchallSchema,
    );
    const entries = Object.fromEntries(encoded.entries());

    expect(entries["fixed"]).toBe("10");
    expect(entries["dynamicA"]).toBe("foo");
    expect(entries["dynamicB"]).toBe("bar");

    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      catchallSchema,
    );

    expect(decoded.fixed).toBe(10);
    expect(decoded.dynamicA).toBe("foo");
    expect(decoded.dynamicB).toBe("bar");
  });

  it("round-trips objects with coerce/transform by parsing before/after", () => {
    const effectsSchema = z.object({
      num: z.coerce.number(),
      flag: z.coerce.boolean(),
      date: z.coerce.date(),
      upper: z.string().transform((s) => s.toUpperCase()),
    });

    // 生値を z.parse してから encode する（transformer は effects を直接扱わないため）
    const parsed = effectsSchema.parse({
      num: "42",
      flag: "true",
      date: "2025-03-01T01:02:03.000Z",
      upper: "hello",
    });

    const encoded = encodeSearchParams(parsed, effectsSchema);
    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      effectsSchema,
    );
    // decode 後も z.parse を通して effects を適用し、パース前と同じになることを検証
    const reparsed = effectsSchema.parse(decoded);

    expect(reparsed).toEqual(parsed);
  });

  // transform が非可逆な場合、reparse で元の値に戻らない
  it("non-idempotent transform does not provide right result when reparsing", () => {
    const transformSchema = z.object({
      doubled: z.string().transform((s) => Number(s) * 2),
      nested: z.object({
        len: z.string().transform((s) => s.length),
      }),
    });

    // transform を適用するため、encode 前に parse で正規化しておく
    const parsed = transformSchema.parse({
      doubled: "21",
      nested: { len: "abcd" },
    });

    const encoded = encodeSearchParams(parsed, transformSchema);
    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      transformSchema,
    );
    const reparsed = transformSchema.parse(decoded);

    expect(reparsed).not.toEqual({
      doubled: 42,
      nested: { len: 4 },
    });
    expect(reparsed).not.toEqual(parsed);
  });

  // validate modeでは、非可逆なtransformの場合、エラーを投げる
  it("non-idempotent transform throws error when validate mode is enabled", () => {
    const transformSchema = z.object({
      doubled: z.string().transform((s) => Number(s) * 2),
      nested: z.object({
        len: z.string().transform((s) => s.length),
      }),
    });

    // transform を適用するため、encode 前に parse で正規化しておく
    const parsed = transformSchema.parse({
      doubled: "21",
      nested: { len: "abcd" },
    });

    expect(() => encodeSearchParams(parsed, transformSchema, true)).toThrow(
      "reparsed value is not equal to original value",
    );
  });

  it("round-trips values guarded by superRefine when valid", () => {
    const bookingSchema = z
      .object({
        start: z.coerce.date(),
        end: z.coerce.date(),
      })
      .superRefine((val, ctx) => {
        if (val.end <= val.start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "end must be after start",
          });
        }
      });

    const parsed = bookingSchema.parse({
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-01-02T00:00:00.000Z",
    });

    const encoded = encodeSearchParams(parsed, bookingSchema);
    const decoded = decodeSearchParams(
      new URLSearchParams(encoded),
      bookingSchema,
    );
    const reparsed = bookingSchema.parse(decoded);

    expect(reparsed).toEqual(parsed);
  });

  it("superRefine is enforced when parsing decoded values (invalid case)", () => {
    const bookingSchema = z
      .object({
        start: z.coerce.date(),
        end: z.coerce.date(),
      })
      .superRefine((val, ctx) => {
        if (val.end <= val.start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "end must be after start",
          });
        }
      });

    // 手動で start > end のエンコードを作成（日付は pathUtil のフォーマット YYYYMMDDHHmmssSSS）
    const encoded = new URLSearchParams({
      start: "20250102000000000",
      end: "20250101000000000",
    });

    const decoded = decodeSearchParams(encoded, bookingSchema);
    expect(() => bookingSchema.parse(decoded)).toThrow(
      "end must be after start",
    );
  });
});
