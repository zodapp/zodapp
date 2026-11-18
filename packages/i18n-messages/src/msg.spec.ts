import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createMsg,
  defineMessages,
  encodeMsgKey,
  lookupFromDictionaries,
  messagesFromTranslator,
  msgKey,
  parseMsgKey,
  resolveMsg,
  type MessagesOf,
} from "./index";

const testEn = defineMessages({
  "test.title": "Title",
  "test.rowCount": ({ count }: { count: number }) => `${count} rows`,
  "test.tooShort": ({ length }: { length: string }) =>
    `At least ${length} characters`,
  "test.required": (p?: { expected?: string }) =>
    p?.expected ? `Required (${p.expected})` : "Required",
});

declare module "./types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation のため
  interface RegisteredMessages extends MessagesOf<typeof testEn> {}
}

const testJa = {
  "test.title": "タイトル",
  "test.rowCount": ({ count }) => `${count} 件`,
  "test.tooShort": ({ length }) => `${length}文字以上`,
  "test.required": () => "必須",
} satisfies MessagesOf<typeof testEn>;

describe("msgKey / parseMsgKey", () => {
  it("キーだけなら ? を付けない", () => {
    expect(msgKey("test.title")).toBe("test.title");
  });

  it("params を URLSearchParams の書式で詰め、parseMsgKey で戻す", () => {
    const text = msgKey("test.tooShort", { length: 3 });
    expect(text).toBe("test.tooShort?length=3");
    expect(parseMsgKey(text)).toEqual({
      key: "test.tooShort",
      params: { length: "3" },
    });
  });

  it("真偽・Date・記号を含む値も往復する", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    const text = encodeMsgKey("a.b", {
      flag: true,
      at: date,
      s: "a&b=c?d e/*x*/",
      skip: undefined,
    });
    expect(parseMsgKey(text)?.params).toEqual({
      flag: "true",
      at: "2026-01-02T03:04:05.000Z",
      s: "a&b=c?d e/*x*/",
    });
  });

  it("キーの形でない文字列は undefined", () => {
    expect(parseMsgKey("3文字以上で入力")).toBeUndefined();
    expect(parseMsgKey("hello world")).toBeUndefined();
  });

  it("キーの形でないキーは encodeMsgKey が throw する", () => {
    expect(() => encodeMsgKey("a b")).toThrow();
  });

  it("型: 登録されていないキーと params の過不足は型エラー", () => {
    // @ts-expect-error 登録されていないキー
    msgKey("test.unknown");
    // @ts-expect-error params が足りない
    msgKey("test.tooShort");
    // @ts-expect-error 文字列の項目に params は渡せない
    msgKey("test.title", { a: 1 });
    // @ts-expect-error params の名前が違う
    msgKey("test.tooShort", { len: 3 });
    expectTypeOf(msgKey("test.rowCount", { count: 1 })).toBeString();
  });

  it("型: すべて省略できる params は省ける", () => {
    expect(msgKey("test.required")).toBe("test.required");
    expect(msgKey("test.required", { expected: "number" })).toBe(
      "test.required?expected=number",
    );
    const msg = createMsg(lookupFromDictionaries(testEn));
    expect(msg("test.required")).toBe("Required");
    expect(msg.resolve("test.required?expected=number")).toBe(
      "Required (number)",
    );
    // @ts-expect-error params の名前が違う
    msgKey("test.required", { other: "x" });
  });
});

describe("createMsg / resolveMsg", () => {
  const msg = createMsg(lookupFromDictionaries(testEn, testJa));

  it("後ろの辞書が優先される", () => {
    expect(msg("test.title")).toBe("タイトル");
    expect(msg("test.rowCount", { count: 2 })).toBe("2 件");
  });

  it("辞書に無いキーはキーをそのまま返す", () => {
    const empty = createMsg(() => undefined);
    expect(empty("test.title")).toBe("test.title");
  });

  it("resolve はキーなら訳し、そうでなければそのまま返す", () => {
    expect(msg.resolve("test.tooShort?length=3")).toBe("3文字以上");
    expect(msg.resolve("3文字以上で入力")).toBe("3文字以上で入力");
    expect(msg.resolve("unknown.key?x=1")).toBe("unknown.key?x=1");
    expect(msg.resolve(undefined)).toBeUndefined();
  });

  it("resolveMsg は辞書をそのまま受け取れる", () => {
    expect(resolveMsg(testEn, "test.title")).toBe("Title");
  });

  it("型: msg の params の過不足は型エラー", () => {
    // @ts-expect-error params が足りない
    msg("test.rowCount");
    // @ts-expect-error params の型が違う
    msg("test.rowCount", { count: "1" });
  });
});

describe("messagesFromTranslator", () => {
  const resources: Record<string, string> = {
    "test.title": "From t",
    "test.rowCount": "{{count}} rows from t",
  };
  const t = (key: string, params?: Record<string, unknown>) => {
    const template = resources[key];
    if (template === undefined) return key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
      String(params?.[name] ?? ""),
    );
  };

  it("訳があるキーは t を呼び、無いキーは既定に落ちる", () => {
    const msg = createMsg(
      lookupFromDictionaries(testEn, messagesFromTranslator(t)),
    );
    expect(msg("test.title")).toBe("From t");
    expect(msg("test.rowCount", { count: 3 })).toBe("3 rows from t");
    expect(msg("test.tooShort", { length: "2" })).toBe("At least 2 characters");
  });
});
