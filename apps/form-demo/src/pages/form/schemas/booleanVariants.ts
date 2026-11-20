import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconToggleLeft } from "@tabler/icons-react";

export const formId = "booleanVariants";
export const title = "zf.boolean";
export const description = msgKey(
  "formDemo.page.booleanVariants.description" /* i18n: スイッチ・チェックボックス・選択肢での入力と、「はい」「いいえ」の文言 */,
);
export const icon = IconToggleLeft;
export const category = "Basic";

export const schema = z
  .object({
    defaultSwitch: zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.booleanVariants.defaultSwitch" /* i18n: 既定（Switch） */,
      ),
    }),
    checkbox: zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.booleanVariants.checkbox" /* i18n: チェックボックス（uiType: checkbox） */,
      ),
      uiType: "checkbox",
    }),
    select: zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.booleanVariants.select" /* i18n: セレクト（uiType: select） */,
      ),
      uiType: "select",
    }),
    // trueLabel / falseLabel は select や readOnly 表示での表示文言になる
    withLabels: zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.booleanVariants.withLabels" /* i18n: 表示文言つき（trueLabel / falseLabel） */,
      ),
      uiType: "select",
      trueLabel: msgKey(
        "formDemo.booleanVariants.withLabels.trueLabel" /* i18n: 公開する */,
      ),
      falseLabel: msgKey(
        "formDemo.booleanVariants.withLabels.falseLabel" /* i18n: 非公開にする */,
      ),
    }),
    readOnlyWithLabels: zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.booleanVariants.readOnlyWithLabels" /* i18n: 読み取り表示（trueLabel / falseLabel が使われる） */,
      ),
      readOnly: true,
      trueLabel: msgKey(
        "formDemo.booleanVariants.readOnlyWithLabels.trueLabel" /* i18n: 公開する */,
      ),
      falseLabel: msgKey(
        "formDemo.booleanVariants.readOnlyWithLabels.falseLabel" /* i18n: 非公開にする */,
      ),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  defaultSwitch: true,
  checkbox: false,
  select: true,
  withLabels: false,
  readOnlyWithLabels: true,
};

export type SchemaType = z.infer<typeof schema>;
