/**
 * zf.*.registry の型の約束（受け付けるスキーマ）と、実際に描ける型がそろっていること（#9）
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf, getMeta } from "./index";

describe("zf.*.registry の型の約束", () => {
  it("zf.date.registry は z.coerce.date() を受け付ける（z.date() と同じ部品で描く）", () => {
    const schema = z.coerce.date().register(zf.date.registry, { label: "日付" });
    expect(getMeta(schema)?.typeName).toBe("date");
  });

  it("zf.externalKey.registry は書式付きの文字列を受け付ける", () => {
    const schema = z.email().register(zf.externalKey.registry, {
      externalKeyConfig: { type: "mock", topic: "users" } as never,
    });
    expect(getMeta(schema)?.typeName).toBe("externalKey");
  });

  it("zf.externalFile.registry は書式付きの文字列を受け付ける", () => {
    const schema = z.url().register(zf.externalFile.registry, {
      fileConfig: { type: "anyStorage" },
    });
    expect(getMeta(schema)?.typeName).toBe("externalFile");
  });

  it("受け付けない型は型エラーになる", () => {
    // @ts-expect-error 数は外部キーにならない
    z.number().register(zf.externalKey.registry, {
      externalKeyConfig: { type: "mock" } as never,
    });
    // @ts-expect-error 数は外に置いたファイルにならない
    z.number().register(zf.externalFile.registry, {
      fileConfig: { type: "anyStorage" },
    });
    // @ts-expect-error 文字列は日付の registry では受け付けない（z.iso.datetime() などを使う）
    z.string().register(zf.date.registry, {});
  });
});
