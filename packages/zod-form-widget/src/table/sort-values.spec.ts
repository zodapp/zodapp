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
  });

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

  it("computed がオブジェクト（link・badge）を返すときは、画面に出る文字（label）", () => {
    const link = zfReact.computed().register(zf.computed.registry, {
      label: "資料",
      dependsOnParent: true,
      compute: ({ parent }: { parent: { title: string } }) => ({
        type: "link" as const,
        label: parent.title,
        href: `https://example.com/${parent.title}`,
      }),
    });
    const badge = zfReact.computed().register(zf.computed.registry, {
      label: "区分",
      dependsOnParent: true,
      compute: ({ parent }: { parent: { kind: string } }) => ({
        type: "badge" as const,
        label: parent.kind === "a" ? "あ" : "い",
        value: parent.kind === "a" ? "z" : "y",
        color: "blue",
      }),
    });
    expect(sortValueOf(columnOf("link", link), { title: "仕様書" }, {})).toBe(
      "仕様書",
    );
    // badge は value ではなく、画面に出る label で並べる
    expect(sortValueOf(columnOf("badge", badge), { kind: "a" }, {})).toBe("あ");
  });

  it("computed が label の無いオブジェクトや React の要素を返すときは null（最後）", () => {
    const icon = zfReact.computed().register(zf.computed.registry, {
      label: "印",
      compute: () => ({ type: "icon" as const, icon: "star" }),
    });
    const element = zfReact.computed().register(zf.computed.registry, {
      label: "要素",
      // React の要素の代わり（$$typeof を持つオブジェクト）
      compute: () =>
        ({ $$typeof: Symbol.for("react.element"), label: "x" }) as never,
    });
    expect(sortValueOf(columnOf("icon", icon), {}, {})).toBeNull();
    expect(sortValueOf(columnOf("element", element), {}, {})).toBeNull();
  });

  it("ほかは値そのもの", () => {
    expect(sortValueOf(columnOf("n", zf.number()), { n: 5 }, {})).toBe(5);
  });
});
