import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  choicesOf,
  toEnumOptionValue,
  fromEnumOptionValue,
  enumOptionsOf,
  enumOptionDataOf,
} from "./enum";
import { isEnumValueListed } from "./unlisted";

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

describe("choicesOf（literal に入るすべての値と、null・undefined の腕）", () => {
  const union = zf.union([
    zf.literal(true),
    zf.literal(false),
    zf.literal(10n),
    z.null(),
    z.undefined().register(zf.common.registry, { label: "未定" }),
    zf.literal(["a", "b"]),
  ]);

  it("ラベルが無ければ値を文字にし、bigint は n を付ける。複数の値の literal は値ごとに出す", () => {
    expect(
      choicesOf(union).data.map(({ value, label }) => [value, label]),
    ).toEqual([
      ["0", "true"],
      ["1", "false"],
      ["2", "10n"],
      ["3", "null"],
      ["4", "未定"],
      ["5.0", "a"],
      ["5.1", "b"],
    ]);
  });

  it("null・undefined・false・bigint の値を、選択肢と行き来する", () => {
    const choices = choicesOf(union);
    for (const value of [true, false, 10n, null, undefined, "a", "b"]) {
      const option = choices.toOption(value);
      expect(option).not.toBeNull();
      expect(choices.fromOption(option)).toBe(value);
    }
    expect(choices.toOption(10)).not.toBe(choices.toOption(10n));
  });

  it("null・undefined の腕があるかを返す", () => {
    expect(choicesOf(union)).toMatchObject({
      hasNull: true,
      hasUndefined: true,
    });
    expect(choicesOf(zf.union([zf.literal("a"), z.null()]))).toMatchObject({
      hasNull: true,
      hasUndefined: false,
    });
    expect(
      choicesOf(zf.union([zf.literal("a"), z.literal(undefined)])),
    ).toMatchObject({ hasNull: false, hasUndefined: true });
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

describe("enum の選択肢の名前", () => {
  enum Color {
    Red,
    Blue,
  }
  enum Fruit {
    Apple = "apple",
    Banana = "banana",
  }

  it("object の形の数値の enum は、キーを名前にする", () => {
    const schema = z.enum({ A: 1, B: 2 });
    expect(choicesOf(schema).data).toEqual([
      { value: "1", label: "A", color: "gray" },
      { value: "2", label: "B", color: "gray" },
    ]);
    expect(fromEnumOptionValue(schema, "2")).toBe(2);
  });

  it("数値の TS enum は、逆引きのキーを選択肢に出さない", () => {
    const schema = z.enum(Color);
    expect(enumOptionsOf(schema)).toEqual([
      { value: 0, name: "Red" },
      { value: 1, name: "Blue" },
    ]);
    expect(isEnumValueListed(schema, "Red")).toBe(false);
    expect(isEnumValueListed(schema, 0)).toBe(true);
  });

  it("文字列の TS enum は、キーを名前にする", () => {
    expect(choicesOf(z.enum(Fruit)).data.map((d) => d.label)).toEqual([
      "Apple",
      "Banana",
    ]);
  });

  it("配列の enum と zf.enum は、今までどおり値・label を名前にする", () => {
    expect(choicesOf(z.enum(["a", "b"])).data.map((d) => d.label)).toEqual([
      "a",
      "b",
    ]);
    const labeled = zf.enum([
      zf.literal("x").register(zf.literal.registry, { label: "エックス" }),
      zf.literal("y"),
    ]);
    expect(choicesOf(labeled).data.map((d) => d.label)).toEqual([
      "エックス",
      "y",
    ]);
  });

  it("値から表示名を引く。選択肢に無い値は undefined", () => {
    const schema = z.enum({ A: "a" });
    expect(enumOptionDataOf(schema, "a")?.label).toBe("A");
    expect(enumOptionDataOf(schema, "zzz")).toBeUndefined();
  });
});

describe("choicesOf（NaN の腕）", () => {
  it("NaN の腕を選べ、値と行き来する", () => {
    const choices = choicesOf(z.union([z.literal(NaN), z.literal(1)]));
    expect(choices.toOption(NaN)).toBe("0");
    expect(Number.isNaN(choices.fromOption("0"))).toBe(true);
    expect(choices.toOption(1)).toBe("1");
  });
});
