import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { choicesOf, toEnumOptionValue, fromEnumOptionValue } from "./enum";

describe("enum option value", () => {
  const numberEnum = zf.enum([z.literal(0), z.literal(0.5)]);
  const stringEnum = zf.enum([z.literal("a"), z.literal("b")]);

  it("toEnumOptionValue は値を文字列にし、未選択を null にする (0 は残す)", () => {
    expect(toEnumOptionValue(0)).toBe("0");
    expect(toEnumOptionValue(0.5)).toBe("0.5");
    expect(toEnumOptionValue("a")).toBe("a");
    expect(toEnumOptionValue(undefined)).toBeNull();
    expect(toEnumOptionValue(null)).toBeNull();
    expect(toEnumOptionValue("")).toBeNull();
  });

  it("fromEnumOptionValue は選択肢の元の値 (数値) に戻す", () => {
    expect(fromEnumOptionValue(numberEnum, "0")).toBe(0);
    expect(fromEnumOptionValue(numberEnum, "0.5")).toBe(0.5);
    expect(fromEnumOptionValue(stringEnum, "b")).toBe("b");
    expect(fromEnumOptionValue(numberEnum, null)).toBeUndefined();
    expect(fromEnumOptionValue(numberEnum, "")).toBeUndefined();
  });
});

describe("choicesOf（literal だけの union）", () => {
  const union = zf.union([
    zf
      .literal(10)
      .register(zf.literal.registry, { label: "十", color: "blue" }),
    zf.literal("10").register(zf.literal.registry, { label: "文字の十" }),
    zf.literal("abc"),
  ]);

  it("選択肢は腕の番号を値にし、literal のラベルと色を使う（ラベルが無ければ値）", () => {
    expect(choicesOf(union).data).toEqual([
      { value: "0", label: "十", color: "blue" },
      { value: "1", label: "文字の十", color: "gray" },
      { value: "2", label: "abc", color: "gray" },
    ]);
  });

  it('literal(10) と literal("10") を区別して行き来する', () => {
    const choices = choicesOf(union);
    expect(choices.toOption(10)).toBe("0");
    expect(choices.toOption("10")).toBe("1");
    expect(choices.fromOption("0")).toBe(10);
    expect(choices.fromOption("1")).toBe("10");
  });

  it("未選択は null・undefined、選択肢に無い値は番号と重ならない文字列にする", () => {
    const choices = choicesOf(union);
    expect(choices.toOption(undefined)).toBeNull();
    expect(choices.toOption(null)).toBeNull();
    expect(choices.fromOption(null)).toBeUndefined();
    const unlisted = choices.toOption(99);
    expect(unlisted).not.toBeNull();
    expect(choices.data.some((d) => d.value === unlisted)).toBe(false);
    expect(choices.fromOption(unlisted)).toBeUndefined();
  });

  it("literal でない腕は選択肢に出さず、警告を出す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mixed = zf.union([zf.literal("a"), zf.string()]);
    expect(choicesOf(mixed).data.map((d) => d.value)).toEqual(["0"]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("choicesOf（enum）", () => {
  it("今の enum と同じく、値を文字にしたものでやりとりする", () => {
    const choices = choicesOf(zf.enum([z.literal(0), z.literal("a")]));
    expect(choices.data.map((d) => d.value)).toEqual(["0", "a"]);
    expect(choices.toOption(0)).toBe("0");
    expect(choices.fromOption("0")).toBe(0);
  });
});
