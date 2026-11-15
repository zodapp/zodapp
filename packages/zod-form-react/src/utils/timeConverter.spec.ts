import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTimeConverter } from "./timeConverter";

describe("createTimeConverter: string", () => {
  it("precision -1 は分までで書き、unit も minute になる", () => {
    const schema = z.iso.time({ precision: -1 });
    const c = createTimeConverter({ schema });
    expect(c.unit).toBe("minute");
    expect(c.toPickerValue("09:30")).toBe("09:30");
    const value = c.fromPickerValue("09:30:15");
    expect(value).toBe("09:30");
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("precision 0 は秒まで、precision 2 は小数 2 桁で書く", () => {
    const s0 = z.iso.time({ precision: 0 });
    const c0 = createTimeConverter({ schema: s0 });
    expect(c0.unit).toBe("second");
    expect(c0.fromPickerValue("09:30:15")).toBe("09:30:15");

    const s2 = z.iso.time({ precision: 2 });
    const c2 = createTimeConverter({ schema: s2 });
    expect(c2.unit).toBe("millisecond");
    const value = c2.fromPickerValue("09:30:15.123");
    expect(value).toBe("09:30:15.12");
    expect(s2.safeParse(value).success).toBe(true);
    // 表示も小数 2 桁（欄が受け付ける桁数と同じ）
    expect(c2.toPickerValue("09:30:15.12")).toBe("09:30:15.12");
    expect(c2.toPickerValue("09:30")).toBe("09:30:00.00");
    const c1 = createTimeConverter({ schema: z.iso.time({ precision: 1 }) });
    expect(c1.toPickerValue("09:30:15.2")).toBe("09:30:15.2");
    // 3 桁以上は 3 桁で見せる
    const c3 = createTimeConverter({ schema: z.iso.time({ precision: 3 }) });
    expect(c3.toPickerValue("09:30:15.2")).toBe("09:30:15.200");
  });

  it("precision なしは unit が second（既定）なら HH:mm:ss、millisecond なら HH:mm:ss.SSS で書く", () => {
    const schema = z.iso.time();
    const c = createTimeConverter({ schema });
    expect(c.unit).toBe("second");
    expect(c.fromPickerValue("09:30:15")).toBe("09:30:15");
    // 分までの既存の値も読める
    expect(c.toPickerValue("09:30")).toBe("09:30:00");

    const cm = createTimeConverter({ schema, unit: "minute" });
    expect(cm.toPickerValue("09:30:15.5")).toBe("09:30");
    expect(cm.fromPickerValue("09:30")).toBe("09:30:00");

    const cms = createTimeConverter({ schema, unit: "millisecond" });
    expect(cms.fromPickerValue("09:30:15.5")).toBe("09:30:15.500");
  });

  it("fractionDigits は、データが持てる秒の小数の桁数になる", () => {
    expect(
      createTimeConverter({ schema: z.iso.time({ precision: 3 }) })
        .fractionDigits,
    ).toBe(3);
    expect(
      createTimeConverter({ schema: z.iso.time({ precision: 6 }) })
        .fractionDigits,
    ).toBe(6);
    // precision なしは zod が桁数を問わないので、制限しない
    expect(
      createTimeConverter({ schema: z.iso.time(), unit: "millisecond" })
        .fractionDigits,
    ).toBeUndefined();
    expect(
      createTimeConverter({
        schema: z.number(),
        encoding: "millisecondsOfDay",
      }).fractionDigits,
    ).toBe(3);
    // ミリ秒より細かい桁は 0 として書く
    const c6 = createTimeConverter({ schema: z.iso.time({ precision: 6 }) });
    expect(c6.fromPickerValue("09:30:15.123456")).toBe("09:30:15.123000");
  });

  it("unit がデータより細かいと定義の誤りになる", () => {
    expect(() =>
      createTimeConverter({
        schema: z.iso.time({ precision: -1 }),
        unit: "second",
      }),
    ).toThrow();
    // 粗くする方向は自由
    expect(
      createTimeConverter({
        schema: z.iso.time({ precision: 0 }),
        unit: "hour",
      }).unit,
    ).toBe("hour");
  });

  it("string に encoding を書くと誤り", () => {
    expect(() =>
      createTimeConverter({ schema: z.iso.time(), encoding: "minutesOfDay" }),
    ).toThrow();
  });

  it("hour は HH:00 にそろえて書く", () => {
    const c = createTimeConverter({
      schema: z.iso.time({ precision: -1 }),
      unit: "hour",
    });
    expect(c.toPickerValue("09:30")).toBe("09:30");
    expect(c.fromPickerValue("09:30")).toBe("09:00");
  });

  it("空や読めない値は undefined / null", () => {
    const c = createTimeConverter({ schema: z.iso.time() });
    expect(c.fromPickerValue("")).toBeUndefined();
    expect(c.fromPickerValue(null)).toBeUndefined();
    expect(c.fromPickerValue("25:00")).toBeUndefined();
    expect(c.toPickerValue(undefined)).toBeNull();
    expect(c.toPickerValue("abc")).toBeNull();
  });
});

describe("createTimeConverter: number", () => {
  it("encoding 省略時は secondsOfDay で、unit も second", () => {
    const c = createTimeConverter({ schema: z.number() });
    expect(c.unit).toBe("second");
    expect(c.toPickerValue(9 * 3600 + 30 * 60 + 15)).toBe("09:30:15");
    expect(c.fromPickerValue("09:30:15")).toBe(34215);
  });

  it("minutesOfDay は 0 時からの分", () => {
    const c = createTimeConverter({
      schema: z.number().int().min(0).max(1439),
      encoding: "minutesOfDay",
    });
    expect(c.unit).toBe("minute");
    expect(c.toPickerValue(570)).toBe("09:30");
    expect(c.fromPickerValue("09:30")).toBe(570);
  });

  it("hoursOfDay と millisecondsOfDay", () => {
    const ch = createTimeConverter({
      schema: z.number(),
      encoding: "hoursOfDay",
    });
    expect(ch.unit).toBe("hour");
    expect(ch.toPickerValue(9)).toBe("09:00");
    expect(ch.fromPickerValue("09:00")).toBe(9);

    const cms = createTimeConverter({
      schema: z.number(),
      encoding: "millisecondsOfDay",
      unit: "second",
    });
    expect(cms.toPickerValue(34215123)).toBe("09:30:15");
    expect(cms.fromPickerValue("09:30:15")).toBe(34215000);
  });

  it("unit が encoding より細かいと定義の誤りになる", () => {
    expect(() =>
      createTimeConverter({
        schema: z.number(),
        encoding: "minutesOfDay",
        unit: "second",
      }),
    ).toThrow();
  });

  it("1 日の範囲外の数値は読めない", () => {
    const c = createTimeConverter({
      schema: z.number(),
      encoding: "minutesOfDay",
    });
    expect(c.toPickerValue(1440)).toBeNull();
    expect(c.toPickerValue(-1)).toBeNull();
  });
});
