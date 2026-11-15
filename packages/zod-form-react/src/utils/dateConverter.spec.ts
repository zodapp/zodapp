import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDateConverter } from "./dateConverter";

describe("z.iso.datetime の precision", () => {
  it("precision なしの local でも、既存の分までの値を読める", () => {
    const converter = createDateConverter({
      schema: z.iso.datetime({ local: true }),
      unit: "minute",
    });
    expect(converter.unit).toBe("minute");
    expect(converter.toPickerValue("2026-11-14T10:30")).toBe(
      "2026-11-14 10:30:00",
    );
  });

  it("precision -1 の local は分までで書き、unit も minute になる", () => {
    const schema = z.iso.datetime({ local: true, precision: -1 });
    const converter = createDateConverter({ schema });
    expect(converter.unit).toBe("minute");
    const value = converter.fromPickerValue("2026-11-14 10:30:00");
    expect(value).toBe("2026-11-14T10:30");
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("precision 0 / 2 の local はその桁数で書く", () => {
    const sec = z.iso.datetime({ local: true, precision: 0 });
    expect(
      createDateConverter({ schema: sec }).fromPickerValue(
        "2026-11-14 10:30:15",
      ),
    ).toBe("2026-11-14T10:30:15");
    const two = z.iso.datetime({ local: true, precision: 2 });
    const value = createDateConverter({ schema: two }).fromPickerValue(
      "2026-11-14 10:30:15.123",
    );
    expect(value).toBe("2026-11-14T10:30:15.12");
    expect(two.safeParse(value).success).toBe(true);
  });

  it("precision -1 の UTC は分までで Z を付ける", () => {
    const schema = z.iso.datetime({ precision: -1 });
    const converter = createDateConverter({ schema, timezone: "Asia/Tokyo" });
    const value = converter.fromPickerValue("2026-11-14 10:30:00");
    expect(value).toBe("2026-11-14T01:30Z");
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("precision なしの UTC は second で秒まで書く", () => {
    const schema = z.iso.datetime();
    const converter = createDateConverter({ schema, timezone: "Asia/Tokyo" });
    expect(converter.unit).toBe("second");
    const value = converter.fromPickerValue("2026-11-14 10:30:45");
    expect(value).toBe("2026-11-14T01:30:45Z");
    expect(schema.safeParse(value).success).toBe(true);
  });
});

describe("z.iso.datetime: precision なしは unit で書く形を決める", () => {
  const cases = [
    {
      unit: "minute",
      picker: "2026-11-14 10:30:00",
      utc: "2026-11-14T01:30:00Z",
      local: "2026-11-14T10:30:00",
    },
    {
      unit: "second",
      picker: "2026-11-14 10:30:45",
      utc: "2026-11-14T01:30:45Z",
      local: "2026-11-14T10:30:45",
    },
    {
      unit: "millisecond",
      picker: "2026-11-14 10:30:45.120",
      utc: "2026-11-14T01:30:45.120Z",
      local: "2026-11-14T10:30:45.120",
    },
  ] as const;

  it.each(cases)("$unit（UTC）は $utc", ({ unit, picker, utc }) => {
    const schema = z.iso.datetime();
    const converter = createDateConverter({
      schema,
      unit,
      timezone: "Asia/Tokyo",
    });
    const value = converter.fromPickerValue(picker);
    expect(value).toBe(utc);
    expect(schema.safeParse(value).success).toBe(true);
  });

  it.each(cases)("$unit（local）は $local", ({ unit, picker, local }) => {
    const schema = z.iso.datetime({ local: true });
    const converter = createDateConverter({ schema, unit });
    const value = converter.fromPickerValue(picker);
    expect(value).toBe(local);
    expect(schema.safeParse(value).success).toBe(true);
  });

  it("unit より細かい部分は編集時に 0 になる", () => {
    const converter = createDateConverter({
      schema: z.iso.datetime(),
      unit: "minute",
      timezone: "Asia/Tokyo",
    });
    // 秒付きの既存値を読み、そのまま書き戻すと秒は 00 になる
    const picker = converter.toPickerValue("2026-11-14T01:30:45.678Z");
    expect(converter.fromPickerValue(picker)).toBe("2026-11-14T01:30:00Z");
  });
});

describe("z.iso.datetime: unit が precision より細かいとエラー", () => {
  const cases = [
    { precision: -1, unit: "second" },
    { precision: -1, unit: "millisecond" },
    { precision: 0, unit: "millisecond" },
  ] as const;

  it.each(cases)(
    "precision $precision + unit $unit（UTC）",
    ({ precision, unit }) => {
      expect(() =>
        createDateConverter({ schema: z.iso.datetime({ precision }), unit }),
      ).toThrow(
        `zf.date: unit "${unit}" is finer than the stored value (precision ${precision})`,
      );
    },
  );

  it.each(cases)(
    "precision $precision + unit $unit（local）",
    ({ precision, unit }) => {
      expect(() =>
        createDateConverter({
          schema: z.iso.datetime({ local: true, precision }),
          unit,
        }),
      ).toThrow("is finer than the stored value");
    },
  );

  it("同じか粗い unit はエラーにならない", () => {
    expect(() =>
      createDateConverter({
        schema: z.iso.datetime({ precision: -1 }),
        unit: "minute",
      }),
    ).not.toThrow();
    expect(() =>
      createDateConverter({
        schema: z.iso.datetime({ local: true, precision: 0 }),
        unit: "minute",
      }),
    ).not.toThrow();
    expect(() =>
      createDateConverter({
        schema: z.iso.datetime({ precision: 3 }),
        unit: "millisecond",
      }),
    ).not.toThrow();
  });
});
