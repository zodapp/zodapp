import { z } from "zod";
import { type ReactNode } from "react";

const jsxElementConstructorSchema = z.union([
  z.function(), // 実行結果までは検査しない
  z.instanceof(Function), // クラスコンストラクタも含めるため
]);

/**
 * ReactNode を受け付けるための Zod スキーマ。
 *
 * `z.custom<ReactNode>()` として、プリミティブ/要素/配列/Promise 等を許容します。
 * バリデーションは best-effort で、レンダリング可能性を厳密に保証するものではありません。
 */
export const reactNodeSchema = z.custom<ReactNode>(
  (value): value is ReactNode => {
    if (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint" ||
      typeof value === "boolean"
    ) {
      return true;
    }

    if (reactElementOrReactPortalSchema.safeParse(value).success) {
      return true;
    }

    const isIterable = (value: unknown): value is Iterable<unknown> => {
      return (
        value !== null &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (value as any)?.[Symbol.iterator] === "function"
      );
    };

    if (isIterable(value)) {
      for (const item of value) {
        if (!reactNodeSchema.safeParse(item).success) {
          return false;
        }
      }
      return false;
    }

    if (value instanceof Promise) {
      return true;
    }

    return false;
  },
);

/**
 * ReactElement / ReactPortal 相当の形をざっくり検査する Zod スキーマ。
 *
 * `reactNodeSchema` の内部で利用します。
 */
export const reactElementOrReactPortalSchema = z
  .object({
    type: z.union([z.string(), jsxElementConstructorSchema]),
    props: z.record(z.string(), z.any()),
    key: z.union([z.string(), z.null()]),
    children: z.array(reactNodeSchema).optional(),
  })
  .passthrough();
