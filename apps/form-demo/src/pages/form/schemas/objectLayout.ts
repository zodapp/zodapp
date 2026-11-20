import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconLayout } from "@tabler/icons-react";

export const formId = "objectLayout";
export const title = msgKey(
  "formDemo.page.objectLayout.title" /* i18n: zf.object（並べ方） */,
);
export const description = msgKey(
  "formDemo.page.objectLayout.description" /* i18n: 項目を横に並べる、枠で囲む、表示順を変える */,
);
export const icon = IconLayout;
export const category = "Basic";

const nameFields = {
  lastName: zf.string().register(zf.string.registry, {
    label: msgKey("formDemo.objectLayout.nameFields.lastName" /* i18n: 姓 */),
  }),
  firstName: zf.string().register(zf.string.registry, {
    label: msgKey("formDemo.objectLayout.nameFields.firstName" /* i18n: 名 */),
  }),
  lastNameKana: zf
    .string()
    .register(zf.string.registry, {
      label: msgKey(
        "formDemo.objectLayout.nameFields.lastNameKana" /* i18n: セイ */,
      ),
    })
    .optional(),
  firstNameKana: zf
    .string()
    .register(zf.string.registry, {
      label: msgKey(
        "formDemo.objectLayout.nameFields.firstNameKana" /* i18n: メイ */,
      ),
    })
    .optional(),
};

export const schema = z
  .object({
    // uiType: "horizontal" — 子フィールドを横一列に並べる（折返しなし）
    horizontal: z.object(nameFields).register(zf.object.registry, {
      label: msgKey(
        "formDemo.objectLayout.horizontal" /* i18n: 横並び（uiType: horizontal） */,
      ),
      uiType: "horizontal",
    }),
    // uiType: "horizontal-wrap" — 横並びで幅に応じて折り返す
    horizontalWrap: z.object(nameFields).register(zf.object.registry, {
      label: msgKey(
        "formDemo.objectLayout.horizontalWrap" /* i18n: 横並び折返し（uiType: horizontal-wrap） */,
      ),
      uiType: "horizontal-wrap",
    }),
    // 横並びのエラー：送信するとエラーが出る。横並びは上端でそろうので、エラーの出た欄だけずれることはない。
    // チェックボックスのように上にラベルの無い欄は、ラベル付きの object で包むと入力欄の高さにそろう
    horizontalErrors: z
      .object({
        keyword: zf
          .string()
          .min(2)
          .register(zf.string.registry, {
            label: msgKey(
              "formDemo.objectLayout.horizontalErrors.keyword" /* i18n: キーワード */,
            ),
          }),
        // ラベルの無い入れ子 object：中の欄は、外の欄と同じ高さに並ぶ
        period: z
          .object({
            from: zf
              .string()
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.objectLayout.horizontalErrors.period.from" /* i18n: 開始 */,
                ),
              }),
            to: zf
              .string()
              .min(1)
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.objectLayout.horizontalErrors.period.to" /* i18n: 終了 */,
                ),
              }),
          })
          .register(zf.object.registry, { uiType: "horizontal" }),
        // ラベル付きの object で包んだチェックボックス
        filter: z
          .object({
            activeOnly: zf.boolean().register(zf.boolean.registry, {
              label: msgKey(
                "formDemo.objectLayout.horizontalErrors.filter.activeOnly" /* i18n: 有効のみ */,
              ),
              uiType: "checkbox",
            }),
          })
          .register(zf.object.registry, {
            label: msgKey(
              "formDemo.objectLayout.horizontalErrors.filter" /* i18n: 絞り込み */,
            ),
          }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.objectLayout.horizontalErrors" /* i18n: 横並びのエラー（送信するとエラーが出る） */,
        ),
        uiType: "horizontal-wrap",
      }),
    // uiType: "box" — 枠で囲んで縦に並べる
    boxed: z.object(nameFields).register(zf.object.registry, {
      label: msgKey(
        "formDemo.objectLayout.boxed" /* i18n: 枠囲み（uiType: box） */,
      ),
      uiType: "box",
    }),
    // properties — 表示順をスキーマ定義順から変更する
    // （properties に載せなかったフィールドは表示されない点にも注意）
    reordered: z.object(nameFields).register(zf.object.registry, {
      label: msgKey(
        "formDemo.objectLayout.reordered" /* i18n: 表示順制御（properties: カナ→漢字の順） */,
      ),
      uiType: "box",
      properties: ["lastNameKana", "firstNameKana", "lastName", "firstName"],
    }),
  })
  .register(zf.object.registry, {});

const nameDefaults = {
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
};

export const defaultValues: z.input<typeof schema> = {
  horizontal: nameDefaults,
  horizontalWrap: nameDefaults,
  horizontalErrors: {
    keyword: "a",
    period: { from: "4月", to: "" },
    filter: { activeOnly: false },
  },
  boxed: nameDefaults,
  reordered: nameDefaults,
};

export type SchemaType = z.infer<typeof schema>;
