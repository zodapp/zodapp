import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  externalKeyDisplayLabel,
  isEnumValueListed,
  withUnlistedOption,
} from "./unlisted";

const UNLISTED_LABEL = "（不正な値）";

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
    expect(externalKeyDisplayLabel(options, "u1", false, UNLISTED_LABEL)).toBe(
      "利用者 A",
    );
  });

  it("選択肢に無い値は unlistedLabel（「（不正な値）」）で、生の値は出さない", () => {
    expect(externalKeyDisplayLabel(options, "u9", false, UNLISTED_LABEL)).toBe(
      UNLISTED_LABEL,
    );
  });

  it("allowUnlisted なら、選択肢に無い値もそのまま出す", () => {
    expect(externalKeyDisplayLabel(options, "u9", true, UNLISTED_LABEL)).toBe(
      "u9",
    );
  });
});

describe("withUnlistedOption", () => {
  const options = [{ label: "利用者 A", value: "u1" }];

  it("選択肢に無い値を、選べない選択肢として足す", () => {
    expect(withUnlistedOption(options, "u9", UNLISTED_LABEL)).toEqual([
      ...options,
      { value: "u9", label: UNLISTED_LABEL, disabled: true, color: "red" },
    ]);
  });

  it("値が無いか、選択肢にあるときは、選択肢をそのまま返す", () => {
    expect(withUnlistedOption(options, null, UNLISTED_LABEL)).toEqual(options);
    expect(withUnlistedOption(options, "u1", UNLISTED_LABEL)).toEqual(options);
  });
});
