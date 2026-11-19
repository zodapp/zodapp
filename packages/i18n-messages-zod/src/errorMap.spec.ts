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
  it("bigint の literal の invalid_value でも投げない", () => {
    const result = z.literal(1n).safeParse(2n, { error: zodMsgKeyErrorMap });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "zod.invalidValue?values=1" /* i18n: 無効な値です。修正してください。 */,
    );
  });

  it.each([
    [
      "required（undefined）",
      z.string(),
      undefined,
      "zod.required" /* i18n: 必ず入力してください。 */,
      { expected: "string" },
    ],
    [
      "required（null）",
      z.number(),
      null,
      "zod.required" /* i18n: 必ず入力してください。 */,
      { expected: "number" },
    ],
    [
      "invalidType",
      z.string(),
      1,
      "zod.invalidType" /* i18n: 無効な値です。修正してください。 */,
      { expected: "string", received: "number" },
    ],
    [
      "invalidValue",
      z.enum(["a", "b"]),
      "c",
      "zod.invalidValue" /* i18n: 無効な値です。修正してください。 */,
      { values: "a, b" },
    ],
    [
      "tooSmall.string",
      z.string().min(3),
      "ab",
      "zod.tooSmall.string" /* i18n: p.inclusive === "true" ? `${p.minimum}文字以上で入力してください。` : `${p.minimum}文字より多く入力してください。` */,
      { minimum: "3", inclusive: "true" },
    ],
    [
      "tooSmall.number（gt）",
      z.number().gt(5),
      5,
      "zod.tooSmall.number" /* i18n: p.inclusive === "true" ? `${p.minimum}以上の数値を入力してください。` : `${p.minimum}より大きい数値を入力してください。` */,
      { minimum: "5", inclusive: "false" },
    ],
    [
      "tooSmall.number（int）",
      z.int().min(2),
      1,
      "zod.tooSmall.number" /* i18n: p.inclusive === "true" ? `${p.minimum}以上の数値を入力してください。` : `${p.minimum}より大きい数値を入力してください。` */,
      { minimum: "2", inclusive: "true" },
    ],
    [
      "tooBig.array",
      z.array(z.string()).max(1),
      ["a", "b"],
      "zod.tooBig.array" /* i18n: p.inclusive === "true" ? `${p.maximum}個以下の要素を設定する必要があります。` : `${p.maximum}個より少ない要素を設定する必要があります。` */,
      { maximum: "1", inclusive: "true" },
    ],
    [
      "invalidFormat.email",
      z.email(),
      "x",
      "zod.invalidFormat.email" /* i18n: 有効なメールアドレスを入力してください。 */,
      { format: "email" },
    ],
    [
      "invalidFormat.startsWith",
      z.string().startsWith("ab"),
      "x",
      "zod.invalidFormat.startsWith" /* i18n: "${p.prefix ?? ""}"で始まる文字列を入力してください。 */,
      { format: "starts_with", prefix: "ab" },
    ],
    [
      "notMultipleOf",
      z.number().multipleOf(3),
      4,
      "zod.notMultipleOf" /* i18n: 数値は${p.divisor}の倍数を入力してください。 */,
      { divisor: "3" },
    ],
    [
      "unrecognizedKeys",
      z.strictObject({}),
      { a: 1 },
      "zod.unrecognizedKeys" /* i18n: オブジェクトのキー '${p.keys}' が識別できません。 */,
      { keys: "a" },
    ],
    [
      "invalidUnion",
      z.union([z.string(), z.number()]),
      true,
      "zod.invalidUnion" /* i18n: */,
      {},
    ],
    [
      "invalid（refine）",
      z.string().refine(() => false),
      "x",
      "zod.invalid" /* i18n: 無効な入力です。 */,
      {},
    ],
  ])("%s", (_name, schema, value, key, params) => {
    const parsed = parseMsgKey(firstMessage(schema, value));
    expect(parsed?.key).toBe(key);
    expect(parsed?.params).toMatchObject(params);
  });

  it("date の下限は ISO 文字列で詰める", () => {
    const min = new Date("2026-01-01T00:00:00.000Z");
    const parsed = parseMsgKey(
      firstMessage(z.date().min(min), new Date("2025-01-01")),
    );
    expect(parsed).toEqual({
      key: "zod.tooSmall.date" /* i18n: p.inclusive === "true" ? `${formatDate(p.minimum)} 以降の日時を入力してください。` : `${formatDate(p.minimum)} より後の日時を入力してください。` */,
      params: { minimum: "2026-01-01T00:00:00.000Z", inclusive: "true" },
    });
  });

  it("スキーマに直接書いた文言はマップより優先される", () => {
    expect(firstMessage(z.string().min(3, "生の文言"), "a")).toBe("生の文言");
    expect(
      firstMessage(
        z
          .string()
          .min(3, msgKey("zod.required" /* i18n: 必ず入力してください。 */)),
        "a",
      ),
    ).toBe("zod.required" /* i18n: 必ず入力してください。 */);
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
