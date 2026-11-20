import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/recursiveSchema";

/** form-demo の日本語の辞書（recursiveSchema） */
export const ja = {
  "formDemo.page.recursiveSchema.description":
    "z.lazyを使った再帰的なデータ構造",
  "formDemo.recursiveSchema.anyValueSchema.arm0": "オブジェクト",
  "formDemo.recursiveSchema.anyValueSchema.arm1": "文字列",
  "formDemo.recursiveSchema.anyValueSchema.arm2": "数値",
  "formDemo.recursiveSchema.anyValueSchema.arm3": "真偽値",
  "formDemo.recursiveSchema.anyValueSchema.arm4": "日時",
  "formDemo.recursiveSchema.anyValueSchema.arm5": "長整数",
  "formDemo.recursiveSchema.anyValueSchema": "任意のデータ",
  "formDemo.recursiveSchema.message.compute":
    "z.lazyを使って、ネストした構造を表現できます。オブジェクト内にさらに任意の値を持つことができます。「組織」は、関数で深さを決めた再帰です（optional を付けず、部 → 課 → 係 で終わる）。optional() を付けない再帰は、入れ子の深さの上限（既定 10。z.lazy の meta の maxDepth で変えられる）までは描き、その先は注記になります。optional な再帰や配列を通る再帰は、値のある所まで描くので、上限はかかりません。",
  "formDemo.recursiveSchema.org.department": "部",
  "formDemo.recursiveSchema.org.section": "課",
  "formDemo.recursiveSchema.org.team": "係",
  "formDemo.recursiveSchema.org.department.name": "部の名前",
  "formDemo.recursiveSchema.org.section.name": "課の名前",
  "formDemo.recursiveSchema.org.team.name": "係の名前",
  "formDemo.recursiveSchema.org":
    "組織（関数で深さを決めた再帰：部 → 課 → 係）",
} satisfies MessagesOf<typeof en>;
