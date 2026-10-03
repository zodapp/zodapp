import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconLayout } from "@tabler/icons-react";

export const formId = "objectLayout";
export const title = "レイアウト制御";
export const description =
  "objectのuiType（horizontal / horizontal-wrap / box）と properties による表示順制御";
export const icon = IconLayout;
export const category = "Basic";

const nameFields = {
  lastName: zf.string().register(zf.string.registry, { label: "姓" }),
  firstName: zf.string().register(zf.string.registry, { label: "名" }),
  lastNameKana: zf
    .string()
    .register(zf.string.registry, { label: "セイ" })
    .optional(),
  firstNameKana: zf
    .string()
    .register(zf.string.registry, { label: "メイ" })
    .optional(),
};

export const schema = z
  .object({
    // uiType: "horizontal" — 子フィールドを横一列に並べる（折返しなし）
    horizontal: z
      .object(nameFields)
      .register(zf.object.registry, {
        label: "横並び（uiType: horizontal）",
        uiType: "horizontal",
      }),
    // uiType: "horizontal-wrap" — 横並びで幅に応じて折り返す
    horizontalWrap: z
      .object(nameFields)
      .register(zf.object.registry, {
        label: "横並び折返し（uiType: horizontal-wrap）",
        uiType: "horizontal-wrap",
      }),
    // uiType: "box" — 枠で囲んで縦に並べる
    boxed: z
      .object(nameFields)
      .register(zf.object.registry, {
        label: "枠囲み（uiType: box）",
        uiType: "box",
      }),
    // properties — 表示順をスキーマ定義順から変更する
    // （properties に載せなかったフィールドは表示されない点にも注意）
    reordered: z
      .object(nameFields)
      .register(zf.object.registry, {
        label: "表示順制御（properties: カナ→漢字の順）",
        uiType: "box",
        properties: [
          "lastNameKana",
          "firstNameKana",
          "lastName",
          "firstName",
        ],
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
  boxed: nameDefaults,
  reordered: nameDefaults,
};

export type SchemaType = z.infer<typeof schema>;
