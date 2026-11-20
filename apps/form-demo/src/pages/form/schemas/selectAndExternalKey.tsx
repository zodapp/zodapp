import { useMsg } from "@zodapp/i18n-messages-react";
import { msgKey } from "@zodapp/i18n-messages";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { Button, Group, Stack, Switch, Text } from "@mantine/core";
import { IconListSearch } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import { createE2eHarness } from "../../../components/E2eHarness";
import {
  demoExternalKeyResolvers,
  demoTopics,
  demoValueActionResolver,
  users,
} from "../../../shared/demo/resolvers";

export const formId = "selectAndExternalKey";
export const title = "zf.externalKey";
export const description = msgKey(
  "formDemo.page.selectAndExternalKey.description" /* i18n: 担当者や拠点を一覧から選ぶ。一覧に無い値の扱い、一覧が届くまでの待ち、一覧が届き直したときの扱い、選んだ値の詳細ページへのリンク */,
);
export const icon = IconListSearch;
export const category = "Advanced";

// 値ごとの操作：getActionParams が返す href を、valueActionResolver がリンクにする
const openOffice = {
  getActionParams: ({ value }: { value: string }) => ({
    href: `https://example.com/offices/${value}`,
  }),
};
const openUser = {
  getActionParams: ({ value }: { value: string }) => ({
    href: `https://example.com/users/${value}`,
  }),
};

/**
 * 市区町村：親の都道府県で config が変わる外部キー。
 * config はただのデータなので、親の値で変えるときは dynamic で包んで externalKey の schema を返す。
 * 都道府県を変えると key が変わって選択肢を取り直し、新しい選択肢に無い市区町村は消える（unlisted の既定 clear）。
 */
const citySchema = z.string().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { prefecture?: string }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => ({
      key: parent?.prefecture ?? "",
      schema: zf.string().register(zf.externalKey.registry, {
        label: msgKey(
          "formDemo.selectAndExternalKey.citySchema.resolve.schema" /* i18n: 市区町村 */,
        ),
        externalKeyConfig: {
          type: "mock",
          topic: `cities/${parent?.prefecture ?? ""}`,
        },
      }),
    }),
  }),
);

export const schema = z
  .object({
    // ============================================================
    // string の選択式：suggestions から選ぶ。検証は string のまま
    // ============================================================
    office: zf.string().register(zf.string.registry, {
      label: 'string + uiType: "select" + valueAction',
      uiType: "select",
      suggestions: [
        { label: "東京本社", value: "hq" },
        { label: "大阪支社", value: "osaka" },
      ],
      valueAction: openOffice,
    }),
    officeLegacy: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.officeLegacy" /* i18n: string + uiType: "select"（選択肢に無い保存値もそのまま通る） */,
      ),
      uiType: "select",
      suggestions: [
        { label: "東京本社", value: "hq" },
        { label: "大阪支社", value: "osaka" },
      ],
    }),
    // ============================================================
    // enum の valueAction
    // ============================================================
    status: zf
      .enum([
        zf.literal("open").register(zf.literal.registry, {
          label: msgKey(
            "formDemo.selectAndExternalKey.status.open" /* i18n: 対応中 */,
          ),
        }),
        zf.literal("done").register(zf.literal.registry, {
          label: msgKey(
            "formDemo.selectAndExternalKey.status.done" /* i18n: 完了 */,
          ),
        }),
      ])
      .register(zf.enum.registry, {
        label: "enum + valueAction",
        valueAction: {
          getActionParams: ({ value }) => ({
            href: `https://example.com/status/${value}`,
          }),
        },
      }),
    // ============================================================
    // externalKey：選択肢は resolver から届く（デモでは 0.4 秒待たせる）
    // ============================================================
    assignee: zf.string().register(zf.externalKey.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.assignee" /* i18n: externalKey（既定：選択肢に無い値は誤り）+ valueAction */,
      ),
      externalKeyConfig: { type: "mock", topic: "users" },
      valueAction: openUser,
    }),
    assigneeFree: zf.string().register(zf.externalKey.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.assigneeFree" /* i18n: externalKey + allowUnlisted（選択肢に無い値も通す） */,
      ),
      externalKeyConfig: { type: "mock", topic: "users" },
      allowUnlisted: true,
    }),
    slowAssignee: zf.string().register(zf.externalKey.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.slowAssignee" /* i18n: externalKey（取得に 3 秒かかる。読み込み中は選べず、送信も止まる） */,
      ),
      externalKeyConfig: { type: "mock", topic: "users", demoDelayMs: 3000 },
    }),
    // ============================================================
    // 同じ購読のまま選択肢が届き直す externalKey（フォームの上のボタンで topic を変える）
    // key は変わらないので購読は張り直さない。届いた選択肢に値が無いときは unlisted に従う
    // ============================================================
    onDuty: zf.string().register(zf.externalKey.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.onDuty" /* i18n: 当番（既定の clear。選んだ人が選択肢から外れると値が消え、戻っても値は戻らない） */,
      ),
      externalKeyConfig: { type: "mock", topic: "onDuty" },
    }),
    onDutyKeep: zf.string().register(zf.externalKey.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.onDutyKeep" /* i18n: 当番（unlisted: keep。外れると値を残して「（不正な値）」とエラーを出し、戻れば元の表示に戻る） */,
      ),
      externalKeyConfig: { type: "mock", topic: "onDuty" },
      unlisted: "keep",
    }),
    // ============================================================
    // 親の値で選択肢を変える externalKey（dynamic で包む）
    // ============================================================
    prefecture: zf.string().register(zf.externalKey.registry, {
      label: msgKey(
        "formDemo.selectAndExternalKey.prefecture" /* i18n: 都道府県 */,
      ),
      externalKeyConfig: { type: "mock", topic: "prefectures" },
    }),
    city: citySchema,
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  office: "hq",
  officeLegacy: "closed-branch",
  status: "open",
  assignee: "u-001",
  assigneeFree: "u-999",
  slowAssignee: "u-002",
  onDuty: "u-002",
  onDutyKeep: "u-002",
  prefecture: "tokyo",
  city: "shinjuku",
} satisfies z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

// 当番の選択肢を届け直す。同じ topic なので、両方の欄に同じ選択肢が届く
const deliverOnDuty = (without?: string) =>
  demoTopics.onDuty.set(users.filter((user) => user.value !== without));

// 見るための部品（値・エラー・送信・ログ）
const harness = [createE2eHarness({ formId })];

export const Component = () => {
  const msg = useMsg();
  const [rotating, setRotating] = useState(false);

  // topic はページをまたいで残るので、離れるときに全員へ戻す
  useEffect(() => () => deliverOnDuty(), []);

  // 自動で届け直す：5 秒ごとに一人ずつ外す
  useEffect(() => {
    if (!rotating) return;
    let tick = 0;
    const timer = setInterval(() => {
      deliverOnDuty(users[tick % users.length]?.value);
      tick += 1;
    }, 5000);
    return () => clearInterval(timer);
  }, [rotating]);

  return (
    <Stack>
      <Stack gap={4}>
        <Text size="sm">
          {msg(
            "formDemo.selectAndExternalKey.try.heading" /* i18n: 当番の選択肢を届け直す（2 つの「当番」の欄が同じ topic を購読している） */,
          )}
        </Text>
        <Group>
          <Button variant="default" onClick={() => deliverOnDuty()}>
            {msg(
              "formDemo.selectAndExternalKey.try.all" /* i18n: 全員を届け直す */,
            )}
          </Button>
          <Button variant="default" onClick={() => deliverOnDuty("u-002")}>
            {msg(
              "formDemo.selectAndExternalKey.try.without" /* i18n: ${name}を外して届け直す */,
              {
                name:
                  users.find((user) => user.value === "u-002")?.label ??
                  "u-002",
              },
            )}
          </Button>
        </Group>
        <Switch
          label={msg(
            "formDemo.selectAndExternalKey.try.rotate" /* i18n: 5 秒ごとに一人ずつ外して届け直す */,
          )}
          checked={rotating}
          onChange={(event) => setRotating(event.currentTarget.checked)}
        />
      </Stack>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        externalKeyResolvers={demoExternalKeyResolvers}
        valueActionResolver={demoValueActionResolver}
        actionComponents={harness}
      />
    </Stack>
  );
};
