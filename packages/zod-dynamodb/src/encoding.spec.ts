import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  compareKeyStrings,
  decodeKeyValue,
  decodeNumber,
  decodeString,
  encodeKeyValue,
  encodeNumber,
  encodeString,
  encoderFor,
} from "./encoding";
import { DefinitionError, ValidationError } from "./errors";
import { composeKey, decomposeKey } from "./keys";

const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);

/** 文字列をコードポイントの並びとして比べる（UTF-8のバイト順と同じ） */
const compareCodePoints = (a: string, b: string) => {
  const ca = [...a].map((c) => c.codePointAt(0)!);
  const cb = [...b].map((c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
    if (ca[i] !== cb[i]) return ca[i]! - cb[i]!;
  }
  return ca.length - cb.length;
};

const keyString = fc.string({
  unit: fc.oneof(
    fc.constantFrom("\u0000", "\n", " ", "!", '"', "#", "$", "%", "/", "-"),
    fc.constantFrom("a", "b", "z", "0", "9", "東", "京", "😀"),
  ),
  maxLength: 8,
});

describe("文字列のエンコーディング", () => {
  it.each([
    ["w1", "w1"],
    ["01JBX6Q4M2", "01JBX6Q4M2"],
    ["東京", "東京"],
    ["100%", "100%"],
    ["a#b", "a$Sb"],
    ["Bob Smith", "Bob$PSmith"],
    ["hi!", "hi$Q"],
    ["$5", "$T5"],
    ["", "$/"],
  ])("%j → %s", (value, encoded) => {
    expect(encodeString(value)).toBe(encoded);
    expect(decodeString(encoded)).toBe(value);
  });

  it("エンコードして逆算すると元に戻る", () => {
    fc.assert(
      fc.property(keyString, (s) => {
        expect(decodeString(encodeString(s))).toBe(s);
      }),
    );
  });

  it("エンコード後の順序が元の文字列の順序と一致する", () => {
    fc.assert(
      fc.property(keyString, keyString, (a, b) => {
        expect(sign(compareKeyStrings(encodeString(a), encodeString(b)))).toBe(
          sign(compareCodePoints(a, b)),
        );
      }),
    );
  });

  it("エンコード後の文字はすべて区切り文字より大きい", () => {
    fc.assert(
      fc.property(keyString, (s) => {
        for (const ch of encodeString(s)) {
          expect(ch.codePointAt(0)!).toBeGreaterThan("#".codePointAt(0)!);
        }
      }),
    );
  });
});

describe("数値のエンコーディング", () => {
  it.each([
    [7, "$*c01c000000000000"],
    [42, "$*c045000000000000"],
    [-1.5, "$*4007ffffffffffff"],
    [0, "$*8000000000000000"],
    [1, "$*bff0000000000000"],
    [-1, "$*400fffffffffffff"],
    [5e-324, "$*8000000000000001"],
    [-5e-324, "$*7ffffffffffffffe"],
    [Number.MAX_VALUE, "$*ffefffffffffffff"],
    [-Number.MAX_VALUE, "$*0010000000000000"],
  ])("%d → %s", (n, encoded) => {
    expect(encodeNumber(n)).toBe(encoded);
    expect(decodeNumber(encoded)).toBe(n);
  });

  it("-0 と 0 は同じキーになる", () => {
    expect(encodeNumber(-0)).toBe(encodeNumber(0));
  });

  it("整数と小数を区別せず、逆算でき、順序を保つ（非正規化数を含む）", () => {
    const num = fc.oneof(
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.integer(),
      fc.constantFrom(Number.MIN_VALUE, -Number.MIN_VALUE, 1, 1.5, 2, 0),
    );
    fc.assert(
      fc.property(num, num, (a, b) => {
        expect(decodeNumber(encodeNumber(a))).toBe(a === 0 ? 0 : a);
        expect(sign(compareKeyStrings(encodeNumber(a), encodeNumber(b)))).toBe(
          sign(a - b),
        );
      }),
    );
  });

  it("NaN と Infinity はエラーにする", () => {
    expect(() => encodeKeyValue(Number.NaN)).toThrow(ValidationError);
    expect(() => encodeKeyValue(Infinity)).toThrow(ValidationError);
  });
});

describe("型識別子方式", () => {
  const d = new Date("2026-10-28T00:00:00Z");

  it.each([
    [null, "$%"],
    [false, "$("],
    [true, "$)"],
    [d, "$+2026-10-28T00:00:00.000Z"],
    ["", "$/"],
    ["true", "true"],
  ])("%j → %s", (value, encoded) => {
    expect(encodeKeyValue(value)).toBe(encoded);
    expect(decodeKeyValue(encoded)).toEqual(value);
  });

  it("Schemaを使わずに逆算できる", () => {
    const value = fc.oneof(
      fc.constant(null),
      fc.boolean(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.date({
        min: new Date("0000-01-01T00:00:00.000Z"),
        max: new Date("9999-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
      keyString,
    );
    fc.assert(
      fc.property(value, (v) => {
        const back = decodeKeyValue(encodeKeyValue(v));
        expect(back).toEqual(v === 0 ? 0 : v);
      }),
    );
  });

  it("型をまたいだ並び順は null < false < true < 数値 < Date < 文字列", () => {
    const ordered = [
      null,
      false,
      true,
      -Number.MAX_VALUE,
      Number.MAX_VALUE,
      new Date("0000-01-01T00:00:00.000Z"),
      new Date("9999-12-31T23:59:59.999Z"),
      "",
      "\u0000",
      " a",
      "$",
      "a",
    ];
    for (let i = 0; i + 1 < ordered.length; i++) {
      expect(
        compareKeyStrings(
          encodeKeyValue(ordered[i]),
          encodeKeyValue(ordered[i + 1]),
        ),
      ).toBeLessThan(0);
    }
  });

  it("Dateは時刻順に並ぶ", () => {
    const date = fc.date({
      min: new Date("0000-01-01T00:00:00.000Z"),
      max: new Date("9999-12-31T23:59:59.999Z"),
      noInvalidDate: true,
    });
    fc.assert(
      fc.property(date, date, (a, b) => {
        expect(
          sign(compareKeyStrings(encodeKeyValue(a), encodeKeyValue(b))),
        ).toBe(sign(a.getTime() - b.getTime()));
      }),
    );
  });

  it("年が 0000〜9999 の範囲外の Date はエラーにする", () => {
    expect(() => encodeKeyValue(new Date("+010000-01-01T00:00:00Z"))).toThrow(
      ValidationError,
    );
    expect(() => encodeKeyValue(new Date("-000001-12-31T00:00:00Z"))).toThrow(
      ValidationError,
    );
  });
});

describe("キーにできるSchema", () => {
  it("union と literal の union をキーにでき、型を保って往復する", () => {
    const union = encoderFor(z.union([z.string(), z.number()]), "f");
    expect(union.isString).toBe(false);
    expect(union.decode(union.encode("1"))).toBe("1");
    expect(union.decode(union.encode(1))).toBe(1);
    const literals = encoderFor(z.literal(["true", true]), "f");
    expect(literals.decode(literals.encode("true"))).toBe("true");
    expect(literals.decode(literals.encode(true))).toBe(true);
  });

  it("文字列だけを取るSchemaは beginsWith に使える", () => {
    expect(encoderFor(z.string(), "f").isString).toBe(true);
    expect(encoderFor(z.enum(["a", "b"]), "f").isString).toBe(true);
    expect(encoderFor(z.literal(["a", "b"]), "f").isString).toBe(true);
    expect(encoderFor(z.string().nullable(), "f").isString).toBe(false);
  });

  it("キーにできないSchemaは定義時のエラーにする", () => {
    for (const schema of [
      z.string().transform((s) => s),
      z.string().default("x"),
      z.object({}),
      z.array(z.string()),
      z.union([z.string(), z.object({})]),
    ]) {
      expect(() => encoderFor(schema, "f")).toThrow(DefinitionError);
    }
    expect(() => encoderFor(z.string().optional(), "f")).toThrow(
      DefinitionError,
    );
    expect(() =>
      encoderFor(z.string().optional(), "f", { allowOptional: true }),
    ).not.toThrow();
  });
});

describe("物理キー", () => {
  const part = {
    fields: ["a", "b"],
    encoders: [encoderFor(z.string(), "a"), encoderFor(z.string(), "b")],
  };

  it("区切り文字を含む値でも衝突しない", () => {
    const k1 = composeKey("E", part, { a: "a#b", b: "c" });
    const k2 = composeKey("E", part, { a: "a", b: "b#c" });
    expect(k1).not.toBe(k2);
    expect(decomposeKey("E", part, k1!)).toEqual({ a: "a#b", b: "c" });
  });

  it("値の組の順序とエンコード後の順序が一致する", () => {
    fc.assert(
      fc.property(
        keyString,
        keyString,
        keyString,
        keyString,
        (a1, b1, a2, b2) => {
          const k1 = composeKey("E", part, { a: a1, b: b1 })!;
          const k2 = composeKey("E", part, { a: a2, b: b2 })!;
          const expected =
            sign(compareCodePoints(a1, a2)) || sign(compareCodePoints(b1, b2));
          expect(sign(compareKeyStrings(k1, k2))).toBe(expected);
        },
      ),
    );
  });

  it("フィールドが undefined なら組み立てない", () => {
    expect(composeKey("E", part, { a: "x" })).toBeUndefined();
  });

  it("別のエンティティのキーは逆算できない", () => {
    expect(() => decomposeKey("F", part, "E#a#b")).toThrow();
  });
});
