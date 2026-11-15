import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { getUnwrappedMeta } from "./table-types";
import { isSortableColumn, sortValueOf } from "./sort-values";

const columnOf = (propertyName: string, schema: z.ZodTypeAny) => ({
  propertyName,
  schema,
  meta: getUnwrappedMeta(schema) as never,
});

const status = zf
  .enum([
    zf.literal("open").register(zf.literal.registry, { label: "対応中" }),
    zf.literal("done").register(zf.literal.registry, { label: "完了" }),
  ])
  .register(zf.enum.registry, { label: "状態" });

const total = zfReact
  .computed()
  .register(zf.computed.registry, {
    label: "小計",
    dependsOnParent: true,
    compute: ({ parent }: { parent: { price: number; quantity: number } }) =>
      `${parent.price * parent.quantity}`,
  })
  .optional();

const amount = z.number().register(
  zf.dynamic.registry,
  defineDynamicMeta({
    label: "金額",
    resolve: () => ({ key: "k", schema: z.number() }),
  }),
);

describe("isSortableColumn", () => {
  it("数・文字・enum・computed は並べ替えられ、dynamic は並べ替えない", () => {
    expect(isSortableColumn(columnOf("n", zf.number()))).toBe(true);
    expect(isSortableColumn(columnOf("s", zf.string()))).toBe(true);
    expect(isSortableColumn(columnOf("status", status))).toBe(true);
    expect(isSortableColumn(columnOf("total", total))).toBe(true);
    expect(isSortableColumn(columnOf("amount", amount))).toBe(false);
  });
});

describe("sortValueOf", () => {
  it("enum は選択肢を定義した順。選択肢に無い値は null（最後）", () => {
    const column = columnOf("status", status);
    expect(sortValueOf(column, { status: "open" }, {})).toBe(0);
    expect(sortValueOf(column, { status: "done" }, {})).toBe(1);
    expect(sortValueOf(column, { status: "gone" }, {})).toBeNull();
  });

  it("computed は計算した値", () => {
    const column = columnOf("total", total);
    expect(sortValueOf(column, { price: 1200, quantity: 3 }, {})).toBe("3600");
  });

  it("ほかは値そのもの", () => {
    expect(sortValueOf(columnOf("n", zf.number()), { n: 5 }, {})).toBe(5);
  });
});
