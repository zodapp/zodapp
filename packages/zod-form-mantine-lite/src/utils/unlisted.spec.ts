import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  UNLISTED_LABEL,
  externalKeyDisplayLabel,
  isEnumValueListed,
} from "./unlisted";

describe("isEnumValueListed", () => {
  it("選択肢にある値は true、無い値は false（数値の選択肢も比べられる）", () => {
    const stringEnum = zf.enum([z.literal("a"), z.literal("b")]);
    const numberEnum = zf.enum([z.literal(0), z.literal(1)]);
    expect(isEnumValueListed(stringEnum, "a")).toBe(true);
    expect(isEnumValueListed(stringEnum, "x")).toBe(false);
    expect(isEnumValueListed(numberEnum, 1)).toBe(true);
    expect(isEnumValueListed(numberEnum, 2)).toBe(false);
  });
});

describe("externalKeyDisplayLabel", () => {
  const options = [{ label: "利用者 A", value: "u1" }];

  it("選択肢にある値は、そのラベル", () => {
    expect(externalKeyDisplayLabel(options, "u1", false)).toBe("利用者 A");
  });

  it("選択肢に無い値は「（不正な値）」で、生の値は出さない", () => {
    expect(externalKeyDisplayLabel(options, "u9", false)).toBe(UNLISTED_LABEL);
    expect(UNLISTED_LABEL).toBe("（不正な値）");
  });

  it("allowUnlisted なら、選択肢に無い値もそのまま出す", () => {
    expect(externalKeyDisplayLabel(options, "u9", true)).toBe("u9");
  });
});
