import { useEffect } from "react";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { Stack, Text } from "@mantine/core";
import { IconTestPipe } from "@tabler/icons-react";

import { AutoForm } from "../../../../components/AutoForm";
import {
  createE2eHarness,
  type HarnessWrite,
} from "../../../../components/E2eHarness";
import { cities, prefectures, towns } from "../../../../shared/demo/resolvers";
import {
  FetchControlPanel,
  controlledLoad,
  createControlledExternalKeyResolvers,
  createFetchControl,
} from "./fetchControl";

export const formId = "e2e-dynamic";
export const title = "e2e：dynamic の読み込み・失敗・再試行・連鎖";
export const description =
  "帳票の種類を変えると、帳票の項目だけを取り直す。遅延の分け方を選び、止めておく分け方では「届ける」「失敗させる」で 1 回ずつ進める。取得を失敗させると「再試行」が出て送信が止まる。都道府県を変えると、市区町村・町名が順に消える";
export const icon = IconTestPipe;
export const category = "e2e";

const control = createFetchControl();

type Template = "invoice" | "receipt";

const templateFields: Record<Template, () => z.ZodTypeAny> = {
  invoice: () =>
    z
      .object({
        dueDate: z.iso.date().register(zf.date.registry, { label: "支払期限" }),
        amount: zf
          .number()
          .min(1)
          .register(zf.number.registry, { label: "請求額" }),
      })
      .register(zf.object.registry, { label: "請求書の項目", uiType: "box" }),
  // 領収書だけが使う部品（真偽）を持たせる。初めて使う部品が出ても、ほかの欄は取り直さない
  receipt: () =>
    z
      .object({
        payer: zf.string().register(zf.string.registry, { label: "宛名" }),
        reissued: zf
          .boolean()
          .register(zf.boolean.registry, { label: "再発行" })
          .optional(),
      })
      .register(zf.object.registry, { label: "領収書の項目", uiType: "box" }),
};

// 帳票の種類で、帳票の項目を取る（key は帳票の種類）
const templateFieldsSchema = z.unknown().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { template?: Template }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => {
      const template = parent?.template ?? "invoice";
      return {
        key: template,
        load: controlledLoad(control, "templateFields", template, () => ({
          schema: templateFields[template](),
        })),
      };
    },
  }),
);

// 都道府県 → 市区町村 → 町名。親が空のときは 0 件の選択肢を届ける
const citySchema = z.string().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { prefecture?: string }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => ({
      key: parent?.prefecture ?? "",
      schema: zf.string().register(zf.externalKey.registry, {
        label: "市区町村",
        externalKeyConfig: {
          type: "mock",
          topic: `cities/${parent?.prefecture ?? ""}`,
        },
        emptyMessage: "先に都道府県を選んでください",
      }),
    }),
  }),
);

const townSchema = z.string().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { city?: string }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => ({
      key: parent?.city ?? "",
      schema: zf.string().register(zf.externalKey.registry, {
        label: "町名",
        externalKeyConfig: {
          type: "mock",
          topic: `towns/${parent?.city ?? ""}`,
        },
        emptyMessage: "先に市区町村を選んでください",
      }),
    }),
  }),
);

export const schema = z
  .object({
    template: zf
      .enum([
        zf
          .literal("invoice")
          .register(zf.literal.registry, { label: "請求書" }),
        zf
          .literal("receipt")
          .register(zf.literal.registry, { label: "領収書" }),
      ])
      .register(zf.enum.registry, { label: "帳票の種類" }),
    templateFields: templateFieldsSchema,
    prefecture: zf.string().register(zf.externalKey.registry, {
      label: "都道府県",
      externalKeyConfig: { type: "mock", topic: "prefectures" },
    }),
    city: citySchema,
    town: townSchema,
  })
  .register(zf.object.registry, {});

// dynamic の欄は静的には値型を持たないため、unknown 経由でキャストする
export const defaultValues = {
  template: "invoice",
  templateFields: { dueDate: "2026-12-31", amount: 10000 },
  prefecture: "tokyo",
  city: "shinjuku",
  town: "nishi-shinjuku",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

const optionsOf = (topic: string) => {
  if (topic === "prefectures") return prefectures;
  const [kind, name = ""] = topic.split("/");
  if (kind === "cities") return name ? cities[name] : [];
  if (kind === "towns") return name ? towns[name] : [];
  return undefined;
};

const externalKeyResolvers = createControlledExternalKeyResolvers(
  control,
  optionsOf,
);

// 帳票の種類を、今と違う方に書き込む
const toggleTemplate: HarnessWrite["run"] = (form) =>
  form.setFieldValue(
    "template",
    form.getFieldValue("template") === "receipt" ? "invoice" : "receipt",
  );

const harness = [
  createE2eHarness<typeof schema>({
    formId,
    writes: [
      {
        label: "外から書き込む（帳票の種類を切り替える）",
        run: toggleTemplate,
      },
      {
        label: "利用者の編集として書き込む（帳票の種類を切り替える）",
        asUser: true,
        run: toggleTemplate,
      },
    ],
  }),
];

export const Component = () => {
  // 分け方・失敗・待っている取得はページをまたいで残るので、離れるときに戻す
  useEffect(() => () => control.reset(), []);

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        手順：遅延の分け方を選んでから、帳票の種類や都道府県を変える。止めておく分け方では、待っている取得の「届ける」「失敗させる」で進める
      </Text>
      <FetchControlPanel control={control} />
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        externalKeyResolvers={externalKeyResolvers}
        actionComponents={harness}
      />
    </Stack>
  );
};
