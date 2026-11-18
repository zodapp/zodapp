import { describe, expect, it } from "vitest";
import { z } from "zod";
import { msgKey, parseMsgKey, resolveMsg } from "@zodapp/i18n-messages";
import { zodMsgKeyErrorMap } from "./index";
import { en, ja } from "./messages";

const firstMessage = (schema: z.ZodType, value: unknown): string => {
  const result = schema.safeParse(value, { error: zodMsgKeyErrorMap });
  if (result.success) throw new Error("expected failure");
  return result.error.issues[0]!.message;
};

describe("zodMsgKeyErrorMap", () => {
  it.each([
    ["required（undefined）", z.string(), undefined, "zod.required", {}],
    ["required（null）", z.number(), null, "zod.required", {}],
    ["invalidType", z.string(), 1, "zod.invalidType", { expected: "string", received: "number" }],
    ["invalidValue", z.enum(["a", "b"]), "c", "zod.invalidValue", { values: "a, b" }],
    ["tooSmall.string", z.string().min(3), "ab", "zod.tooSmall.string", { minimum: "3", inclusive: "true" }],
    ["tooSmall.number（gt）", z.number().gt(5), 5, "zod.tooSmall.number", { minimum: "5", inclusive: "false" }],
    ["tooSmall.number（int）", z.int().min(2), 1, "zod.tooSmall.number", { minimum: "2", inclusive: "true" }],
    ["tooBig.array", z.array(z.string()).max(1), ["a", "b"], "zod.tooBig.array", { maximum: "1", inclusive: "true" }],
    ["invalidFormat.email", z.email(), "x", "zod.invalidFormat.email", { format: "email" }],
    ["invalidFormat.startsWith", z.string().startsWith("ab"), "x", "zod.invalidFormat.startsWith", { format: "starts_with", prefix: "ab" }],
    ["notMultipleOf", z.number().multipleOf(3), 4, "zod.notMultipleOf", { divisor: "3" }],
    ["unrecognizedKeys", z.strictObject({}), { a: 1 }, "zod.unrecognizedKeys", { keys: "a" }],
    ["invalidUnion", z.union([z.string(), z.number()]), true, "zod.invalidUnion", {}],
    ["invalid（refine）", z.string().refine(() => false), "x", "zod.invalid", {}],
  ])("%s", (_name, schema, value, key, params) => {
    const parsed = parseMsgKey(firstMessage(schema, value));
    expect(parsed?.key).toBe(key);
    expect(parsed?.params).toMatchObject(params);
  });

  it("date の下限は ISO 文字列で詰める", () => {
    const min = new Date("2026-01-01T00:00:00.000Z");
    const parsed = parseMsgKey(firstMessage(z.date().min(min), new Date("2025-01-01")));
    expect(parsed).toEqual({
      key: "zod.tooSmall.date",
      params: { minimum: "2026-01-01T00:00:00.000Z", inclusive: "true" },
    });
  });

  it("スキーマに直接書いた文言はマップより優先される", () => {
    expect(firstMessage(z.string().min(3, "生の文言"), "a")).toBe("生の文言");
    expect(firstMessage(z.string().min(3, msgKey("zod.required")), "a")).toBe(
      "zod.required",
    );
  });

  it("ja・en の辞書で訳せる", () => {
    const text = firstMessage(z.string().min(3), "a");
    expect(resolveMsg(ja, text)).toBe("3文字以上で入力してください。");
    expect(resolveMsg(en, text)).toBe("Must be at least 3 characters.");
    expect(resolveMsg(ja, firstMessage(z.string(), undefined))).toBe(
      "必ず入力してください。",
    );
  });

  it("ja と en はキーがそろっている", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });
});
