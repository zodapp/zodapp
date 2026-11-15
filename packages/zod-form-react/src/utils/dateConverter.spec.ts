import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDateConverter } from "./dateConverter";

describe("z.iso.datetime の precision", () => {
  it("precision なしの local は、unit が minute でもミリ秒まで書く（データの形は変えない）", () => {
    const converter = createDateConverter({
      schema: z.iso.datetime({ local: true }),
      unit: "minute",
    });
    expect(converter.unit).toBe("minute");
    expect(converter.fromPickerValue("2026-11-14 10:30:00")).toBe(
      "2026-11-14T10:30:00.000",
    );
    // 分までしかない既存の値も読める
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

  it("precision なしの UTC は従来どおり toISOString", () => {
    const converter = createDateConverter({
      schema: z.iso.datetime(),
      timezone: "Asia/Tokyo",
    });
    expect(converter.fromPickerValue("2026-11-14 10:30:00")).toBe(
      "2026-11-14T01:30:00.000Z",
    );
  });
});
