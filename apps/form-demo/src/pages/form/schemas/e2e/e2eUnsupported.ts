import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-unsupported";
export const title = msgKey(
  "formDemo.page.e2eUnsupported.title" /* i18n: e2e：扱えない型の注記 */,
);
export const description = msgKey(
  "formDemo.page.e2eUnsupported.description" /* i18n: rest 付きの tuple・uiType と要素の型が合わない配列・object を要素に持つ set は、その欄の場所に「扱えません」の注記を出し、ほかの欄は描く。使えないキー名（. を含む）は「このキー名は使えません」と出し、record に保存されていた使えないキーは編集できない行として出す。z.promise() と async の refine があるので、送信は止まり、理由が出る */,
);
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    title: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.e2eUnsupported.title" /* i18n: 見出し */),
    }),
    // rest 付きの tuple
    scores: z
      .tuple([z.string()])
      .rest(z.number())
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.e2eUnsupported.scores" /* i18n: 得点（rest 付きの tuple） */,
        ),
      }),
    // uiType と要素の型が合わない配列（multipleString に number）
    numbers: z.array(z.number()).register(zf.array.registry, {
      label: msgKey(
        "formDemo.e2eUnsupported.numbers" /* i18n: 数の配列（uiType: multipleString） */,
      ),
      uiType: "multipleString",
    }),
    // object を要素に持つ set
    points: z.set(z.object({ x: z.number() })).register(zf.common.registry, {
      label: msgKey(
        "formDemo.e2eUnsupported.points" /* i18n: 点の集合（Set<object>） */,
      ),
    }),
    // 使えないキー名
    settings: z
      .object({
        "a.b": z.string().register(zf.string.registry, {
          label: msgKey(
            "formDemo.e2eUnsupported.settings.a_b" /* i18n: a.b の値 */,
          ),
        }),
        ok: z.string().register(zf.string.registry, {
          label: msgKey(
            "formDemo.e2eUnsupported.settings.ok" /* i18n: 使える値 */,
          ),
        }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.e2eUnsupported.settings" /* i18n: 設定（キー名に . を含む） */,
        ),
      }),
    // record に保存されていた使えないキー
    tags: z.record(z.string(), z.string()).register(zf.record.registry, {
      label: msgKey(
        "formDemo.e2eUnsupported.tags" /* i18n: タグ（保存値に使えないキー） */,
      ),
      uiType: "entries",
    }),
    // promise と async の refine：送信は止まり、理由が出る
    pending: z
      .promise(z.string())
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.e2eUnsupported.pending" /* i18n: 取得中の値（promise） */,
        ),
      })
      .optional(),
    handle: z
      .string()
      .refine(async (value) => value.length > 0)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.e2eUnsupported.handle" /* i18n: ハンドル（async の refine） */,
        ),
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  title: "見出し",
  scores: ["a", 1, 2],
  numbers: [1, 2],
  points: new Set([{ x: 1 }]),
  settings: { "a.b": "x", ok: "y" },
  tags: { "x.y": "保存済み", safe: "ok" },
  handle: "me",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
