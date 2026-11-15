import { describe, expect, it } from "vitest";
import { cleanQuery, createMingoFilter } from "./mingoQuery";

describe("cleanQuery", () => {
  it("undefined の値を落とす", () => {
    expect(cleanQuery({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("中身を落として空になった object も落とす", () => {
    expect(
      cleanQuery({ name: { $contains: undefined }, status: "active" }),
    ).toEqual({ status: "active" });
    expect(cleanQuery({ a: { b: { c: undefined } }, d: 1 })).toEqual({ d: 1 });
  });

  it("全体が空になったら undefined を返す", () => {
    expect(cleanQuery({ name: {} })).toBeUndefined();
    expect(cleanQuery({})).toBeUndefined();
  });

  it("Date と配列は残す（空配列も残す）", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    expect(cleanQuery({ dueAt: { $gte: date, $lte: undefined } })).toEqual({
      dueAt: { $gte: date },
    });
    expect(cleanQuery({ tags: { $in: [] } })).toEqual({ tags: { $in: [] } });
  });

  it("null は条件として残す", () => {
    expect(cleanQuery({ priority: null })).toEqual({ priority: null });
  });
});

describe("createMingoFilter", () => {
  const items = [{ name: "Alpha" }, { name: "beta" }];

  it("空の条件（{ name: {} }）では絞り込まない", () => {
    expect(createMingoFilter({ name: {} })).toBeUndefined();
    expect(
      createMingoFilter({ name: { $contains: undefined } }),
    ).toBeUndefined();
  });

  it("$contains で大文字小文字を無視した部分一致になる", () => {
    const filter = createMingoFilter({ name: { $contains: "AL" } });
    expect(items.filter((item) => filter!(item))).toEqual([{ name: "Alpha" }]);
  });
});
