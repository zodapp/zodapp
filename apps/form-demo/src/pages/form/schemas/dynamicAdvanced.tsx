import { useEffect, useState } from "react";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { Button, Group, Stack, Switch } from "@mantine/core";
import { IconBolt } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import {
  createE2eHarness,
  type HarnessWrite,
} from "../../../components/E2eHarness";
import {
  cities,
  demoValueActionResolver,
  prefectures,
  towns,
} from "../../../shared/demo/resolvers";
import {
  FetchControlPanel,
  controlledLoad,
  createControlledExternalKeyResolvers,
  createFetchControl,
} from "../../../shared/demo/fetchControl";
import { TryBehavior } from "../../../shared/demo/TryBehavior";

export const formId = "dynamicAdvanced";
export const title = "zf.dynamic（読み込み・購読・連動）";
export const description =
  "スキーマをサーバーから読み込む（読み込み中・失敗・再試行）、変わり続ける上限、都道府県→市区町村→町名の連動。帳票の種類を変えると、帳票の項目だけを取り直す。取得を失敗させると「再試行」が出て送信が止まる。都道府県を変えると、市区町村・町名が順に消える。「動きを試す」で取得の時機を選び、止めておく分け方では「届ける」「失敗させる」で 1 回ずつ進める";
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

// 取得の時機（遅延の分け方）と失敗。「動きを試す」の枠で切り替える。
// 既定は見やすい遅延（帳票の項目は 1 秒、選択肢は 0.4 秒）
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
  receipt: () =>
    z
      .object({
        payer: zf.string().register(zf.string.registry, { label: "宛名" }),
        note: zf
          .string()
          .register(zf.string.registry, { label: "但し書き" })
          .optional(),
        // 領収書だけが使う部品（真偽）。初めて使う部品が出ても、ほかの欄は取り直さない
        reissued: zf
          .boolean()
          .register(zf.boolean.registry, { label: "再発行" })
          .optional(),
      })
      .register(zf.object.registry, { label: "領収書の項目", uiType: "box" }),
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
        // 取得した定義のリビジョンを key に含める（リビジョンが変われば別の schema とみなす）
        load: controlledLoad(control, "templateFields", template, () => ({
          key: `${template}@1`,
          schema: templateFields[template](),
        })),
      };
    },
  }),
);

// ============================================================
// 2. 購読：同じ key のまま schema が届き続ける。値は prune されず、検証だけが変わる
//    在庫は「動きを試す」で変える（既定は 3 秒ごとに変わる。ボタンで 1 回ずつ決めることもできる）
// ============================================================

const stockStore = (() => {
  let stock = 10;
  const listeners = new Set<() => void>();
  return {
    get: () => stock,
    set: (next: number) => {
      stock = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

const quantitySchema = z.number().register(
  zf.dynamic.registry,
  defineDynamicMeta({
    dependsOnValue: false,
    resolve: () => ({
      key: "stock",
      subscribe: (emit) => {
        const send = () => {
          const stock = stockStore.get();
          emit({
            key: "stock",
            schema: zf
              .number()
              .min(1)
              .max(stock, `在庫（${stock}）を超えています`)
              .register(zf.number.registry, {
                label: `数量（在庫 ${stock}）`,
              }),
          });
        };
        send();
        return stockStore.subscribe(send);
      },
    }),
  }),
);

// ============================================================
// 3. 親の値で決まる dynamic の連鎖：都道府県 → 市区町村 → 町名
//    上の欄を変えると key が変わって選択肢を取り直し、選択肢に無くなった下の欄が順に消える
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
        // 都道府県が未選択なら選択肢が0件になる。その理由を出す
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
    quantity: quantitySchema,
    prefecture: zf.string().register(zf.externalKey.registry, {
      label: "都道府県",
      externalKeyConfig: { type: "mock", topic: "prefectures" },
    }),
    city: citySchema,
    town: townSchema,
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  template: "invoice",
  templateFields: { dueDate: "2026-12-31", amount: 10000 },
  quantity: 2,
  prefecture: "tokyo",
  city: "shinjuku",
  town: "nishi-shinjuku",
} satisfies z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

// 選択肢（都道府県・市区町村・町名）。親が空のとき（`cities/`・`towns/`）は 0 件を届ける
const optionsOf = (topic: string) => {
  if (topic === "prefectures") return prefectures;
  const [kind, name = ""] = topic.split("/");
  if (kind === "cities") return name ? cities[name] : [];
  if (kind === "towns") return name ? towns[name] : [];
  return undefined;
};

const { resolvers: externalKeyResolvers } =
  createControlledExternalKeyResolvers(control, optionsOf);

// 帳票の種類を、今と違う方に書き込む
const toggleTemplate: HarnessWrite["run"] = (form) =>
  form.setFieldValue(
    "template",
    form.getFieldValue("template") === "receipt" ? "invoice" : "receipt",
  );

// 見るための部品（値・エラー・送信・ログ）。外からの書き込みと、利用者の編集としての書き込みのボタンも出す
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
  useEffect(
    () => () => {
      control.reset();
      stockStore.set(10);
    },
    [],
  );

  // 在庫を 3 秒ごとに変える（既定はオン）
  const [rotating, setRotating] = useState(true);
  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(
      () => stockStore.set(3 + Math.floor(Math.random() * 10)),
      3000,
    );
    return () => clearInterval(timer);
  }, [rotating]);

  return (
    <Stack>
      <TryBehavior description="取得が届く時機を選ぶ・わざと失敗させる・在庫を変える。ふだんは「見やすい遅延」（帳票の項目は 1 秒、選択肢は 0.4 秒）のまま使う。止めておく分け方では「届ける」「失敗させる」で 1 回ずつ進める">
        <FetchControlPanel control={control} />
        <Group gap="xs">
          <Switch
            label="在庫を 3 秒ごとに変える"
            checked={rotating}
            onChange={(event) => setRotating(event.currentTarget.checked)}
          />
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => stockStore.set(3)}
          >
            在庫を 3 にする
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => stockStore.set(10)}
          >
            在庫を 10 にする
          </Button>
        </Group>
      </TryBehavior>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        externalKeyResolvers={externalKeyResolvers}
        valueActionResolver={demoValueActionResolver}
        actionComponents={harness}
      />
    </Stack>
  );
};
