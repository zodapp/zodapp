import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconRefresh } from "@tabler/icons-react";

export const formId = "recursiveSchema";
export const title = "再帰的スキーマ";
export const description = "z.lazyを使った再帰的なデータ構造";
export const icon = IconRefresh;
export const category = "Advanced";

// 再帰の例(union型はtypescript上は潰れてるがこれは再帰のせいなので仕方ない。ランタイムでは正常に動作する)
const anyValueSchema: z.ZodUnion = zf
  .union([
    z
      .object({
        // getDefaultValueは、ZodLazyをすべて評価しようとするので、
        // optionalがないと無限再帰で落ちる。
        value: z.lazy(() => anyValueSchema).optional(),
      })
      .register(zf.object.registry, { label: "オブジェクト" }),
    zf.string().register(zf.string.registry, { label: "文字列" }),
    zf.number().register(zf.number.registry, { label: "数値" }),
    zf.boolean().register(zf.boolean.registry, { label: "真偽値" }),
    zf.date().register(zf.date.registry, { label: "日時" }),
    zf.bigint().register(zf.bigint.registry, { label: "長整数" }),
  ])
  .register(zf.union.registry, { label: "任意のデータ" });

export const schema = z
  .object({
    anyValue: anyValueSchema,
    message: zfReact
      .message()
      .register(zfReact.message.registry, {
        content:
          "z.lazyを使って、ネストした構造を表現できます。オブジェクト内にさらに任意の値を持つことができます。ただし、z.lazyはoptional()をともに使わないと無限再帰で落ちます。",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  anyValue: {
    value: {
      value: "nested string",
    },
  },
};

export type SchemaType = z.infer<typeof schema>;
