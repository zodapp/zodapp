import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

import { AutoForm } from "../../../../components/AutoForm";
import { createE2eHarness } from "../../../../components/E2eHarness";

export const formId = "e2e-open-rewrite";
export const title = "e2e：開いただけで書き換えるもの";
export const description =
  "開くと、選択肢に無い初期値を持つ clear の欄は値が消え、keep の欄は残ってエラーが出る。type の無い古い形の初期値を持つ preprocess の union は、type が補われる。precision の欄は初期値のまま。どれも開いただけでは isDirty は false で、欄を 1 つ編集すると true になる";
export const icon = IconTestPipe;
export const category = "e2e";

const officeOptions = () =>
  [
    zf.literal("hq").register(zf.literal.registry, { label: "東京本社" }),
    zf.literal("osaka").register(zf.literal.registry, { label: "大阪支社" }),
  ] as const;

// 判別子（type）の無い古い形のデータに type を補う
const fillContactType = (value: unknown) => {
  if (value && typeof value === "object" && !("type" in value)) {
    return { ...value, type: "email" in value ? "email" : "phone" };
  }
  return value;
};

const contactSchema = z.preprocess(
  fillContactType,
  z
    .discriminatedUnion("type", [
      z
        .object({
          type: z
            .literal("email")
            .register(zf.literal.registry, { hidden: true }),
          email: zf.string().register(zf.string.registry, { label: "メール" }),
        })
        .register(zf.object.registry, { label: "メール" }),
      z
        .object({
          type: z
            .literal("phone")
            .register(zf.literal.registry, { hidden: true }),
          phone: zf
            .string()
            .register(zf.string.registry, { label: "電話番号" }),
        })
        .register(zf.object.registry, { label: "電話" }),
    ])
    .register(zf.union.registry, {
      label: "連絡先（preprocess の union）",
      selectorLabel: "連絡先の種類",
    }),
);

export const schema = z
  .object({
    officeClear: zf
      .enum(officeOptions())
      .register(zf.enum.registry, { label: "拠点（clear）" })
      .optional(),
    officeKeep: zf
      .enum(officeOptions())
      .register(zf.enum.registry, { label: "拠点（keep）", unlisted: "keep" })
      .optional(),
    contact: contactSchema,
    updatedAt: z.iso
      .datetime({ precision: 0 })
      .register(zf.date.registry, { label: "更新日時（precision 0）" }),
    openAt: z.iso
      .time({ precision: -1 })
      .register(zf.time.registry, { label: "開店時刻（precision -1）" }),
    memo: zf
      .string()
      .register(zf.string.registry, { label: "メモ" })
      .optional(),
  })
  .register(zf.object.registry, {});

// 選択肢に無い拠点、type の無い連絡先を初期値にする
export const defaultValues = {
  officeClear: "closed-branch",
  officeKeep: "closed-branch",
  contact: { email: "contact@example.com" },
  updatedAt: "2026-03-14T09:26:53Z",
  openAt: "09:30",
  memo: "",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

const harness = [createE2eHarness<typeof schema>({ formId })];

export const Component = () => (
  <AutoForm
    schema={schema}
    defaultValues={defaultValues}
    actionComponents={harness}
  />
);
