import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconRefresh } from "@tabler/icons-react";

export const formId = "recursiveSchema";
export const title = "z.lazy";
export const description = msgKey(
  "formDemo.page.recursiveSchema.description" /* i18n: z.lazyを使った再帰的なデータ構造 */,
);
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

// 関数で深さを決めた再帰：optional を付けずに z.lazy で入れ子にしても、
// 関数の中で階層が終わる（係で止まる）ので、全部描ける。
// optional の付かない lazy の連なりは、入れ子の深さの上限（既定 10）までは描く
const ORG_LEVELS = ["部", "課", "係"] as const;
const orgUnit = (level: number): z.ZodTypeAny => {
  const name = zf
    .string()
    .register(zf.string.registry, { label: `${ORG_LEVELS[level]}の名前` });
  if (level === ORG_LEVELS.length - 1) {
    return z
      .object({ name })
      .register(zf.object.registry, {
        label: ORG_LEVELS[level],
        uiType: "box",
      });
  }
  return z
    .object({
      name,
      child: z.lazy(() => orgUnit(level + 1)),
    })
    .register(zf.object.registry, {
      label:
        level === 0
          ? "組織（関数で深さを決めた再帰：部 → 課 → 係）"
          : ORG_LEVELS[level],
      uiType: "box",
    });
};

export const schema = z
  .object({
    anyValue: anyValueSchema,
    organization: z.lazy(() => orgUnit(0)),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        "z.lazyを使って、ネストした構造を表現できます。オブジェクト内にさらに任意の値を持つことができます。「組織」は、関数で深さを決めた再帰です（optional を付けず、部 → 課 → 係 で終わる）。optional() を付けない再帰は、入れ子の深さの上限（既定 10。z.lazy の meta の maxDepth で変えられる）までは描き、その先は注記になります。optional な再帰や配列を通る再帰は、値のある所まで描くので、上限はかかりません。",
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  anyValue: {
    value: {
      value: "nested string",
    },
  },
  organization: {
    name: "営業部",
    child: { name: "第一課", child: { name: "法人係" } },
  },
};

export type SchemaType = z.infer<typeof schema>;
