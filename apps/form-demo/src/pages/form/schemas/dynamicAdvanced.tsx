import { useMemo, useState } from "react";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { useRunAsUserEdit } from "@zodapp/zod-form-react/common";
import type { AutoFormActionComponent } from "@zodapp/zod-form-widget/form";
import { Button, Group, Stack, Switch, Text } from "@mantine/core";
import { IconBolt } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import {
  demoExternalKeyResolvers,
  demoValueActionResolver,
} from "../../../shared/demo/resolvers";

export const formId = "dynamicAdvanced";
export const title = "動的スキーマの応用";
export const description =
  "非同期の resolve（{ key, load }、読み込み中・失敗と再試行）、購読で届き続ける schema、親の値で決まる dynamic の連鎖と prune、利用者の編集と外からの変更の違い";
export const icon = IconBolt;
export const category = "Advanced";

// ============================================================
// 1. 非同期の resolve：{ key, load } を返す。取り直し中は読み込み中で、送信も止まる
//
//    key は取得の単位。同じ key のあいだは load を呼び直さないので、
//    dependsOnParent で兄弟の欄に入力しても取り直さない（帳票の種類が変わったときだけ取り直す）。
//    load が使う値（ここでは帳票の種類）は key に入れる。
//    load は { schema, key } を返せる。取得のあとで決まる同一性（リビジョンなど）はそこで返す
// ============================================================

// 画面のスイッチで切り替える。オンのあいだは取得が失敗する
const failure = { on: false };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      .register(zf.object.registry, {
        label: "請求書の項目（取得に 1 秒かかる）",
        uiType: "box",
      }),
  receipt: () =>
    z
      .object({
        payer: zf.string().register(zf.string.registry, { label: "宛名" }),
        note: zf
          .string()
          .register(zf.string.registry, { label: "但し書き" })
          .optional(),
      })
      .register(zf.object.registry, {
        label: "領収書の項目（取得に 1 秒かかる）",
        uiType: "box",
      }),
};

const templateFieldsSchema = z.unknown().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { template?: Template }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => {
      const template = parent?.template ?? "invoice";
      return {
        key: template,
        load: async () => {
          await wait(1000);
          if (failure.on) throw new Error("取得に失敗しました（デモ）");
          // 取得した定義のリビジョンを key に含める（リビジョンが変われば別の schema とみなす）
          return { key: `${template}@1`, schema: templateFields[template]() };
        },
      };
    },
  }),
);

// ============================================================
// 2. 購読：同じ key のまま schema が届き続ける。値は prune されず、検証だけが変わる
// ============================================================

const quantitySchema = z.number().register(
  zf.dynamic.registry,
  defineDynamicMeta({
    dependsOnValue: false,
    resolve: () => ({
      key: "stock",
      subscribe: (emit) => {
        let stock = 10;
        const send = () =>
          emit({
            key: "stock",
            schema: zf
              .number()
              .min(1)
              .max(stock, `在庫（${stock}）を超えています`)
              .register(zf.number.registry, {
                label: `数量（在庫 ${stock}。3 秒ごとに変わる）`,
              }),
          });
        send();
        const timer = setInterval(() => {
          stock = 3 + Math.floor(Math.random() * 10);
          send();
        }, 3000);
        return () => clearInterval(timer);
      },
    }),
  }),
);

// ============================================================
// 3. 親の値で決まる dynamic の連鎖：都道府県 → 市区町村 → 町名
//    利用者が上の欄を変えると key が変わり、選択肢に無くなった下の欄が順に消える
// ============================================================

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
    quantity: quantitySchema,
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
  quantity: 2,
  prefecture: "tokyo",
  city: "shinjuku",
  town: "nishi-shinjuku",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

// ============================================================
// 4. 利用者の編集と外からの変更：アプリのコードの書き込みは既定で「外から」で、prune しない。
//    useRunAsUserEdit で包むと「利用者の編集」になり、下の欄が prune される
// ============================================================

const setOsaka: AutoFormActionComponent<typeof schema> = ({ form }) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- AutoForm が部品として描画する
  const runAsUserEdit = useRunAsUserEdit();
  return (
    <Group gap="xs">
      <Button
        variant="default"
        size="xs"
        onClick={() => form.setFieldValue("prefecture", "osaka")}
      >
        外から「大阪府」を入れる（prune しない）
      </Button>
      <Button
        variant="light"
        size="xs"
        onClick={() =>
          runAsUserEdit(() => form.setFieldValue("prefecture", "osaka"))
        }
      >
        利用者の編集として「大阪府」を入れる（prune する）
      </Button>
    </Group>
  );
};

export const Component = () => {
  const [failing, setFailing] = useState(false);
  const [submitted, setSubmitted] = useState<SchemaType>();
  const actionComponents = useMemo(() => [setOsaka], []);

  return (
    <Stack>
      <Switch
        label="「帳票の項目」の取得を失敗させる（オンにして帳票の種類を変えると失敗し、オフにして再試行すると戻る）"
        checked={failing}
        onChange={(event) => {
          const checked = event.currentTarget.checked;
          failure.on = checked;
          setFailing(checked);
        }}
      />
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        externalKeyResolvers={demoExternalKeyResolvers}
        valueActionResolver={demoValueActionResolver}
        actionComponents={actionComponents}
        actions={[
          {
            type: "submit",
            label: "送信",
            onSubmit: (data) => setSubmitted(data),
          },
        ]}
        showPreview={true}
      />
      {submitted && (
        <Text size="sm" c="dimmed">
          送信した値: {JSON.stringify(submitted)}
        </Text>
      )}
    </Stack>
  );
};
