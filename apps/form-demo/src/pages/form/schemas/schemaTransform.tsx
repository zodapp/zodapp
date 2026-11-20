import { useMsg } from "@zodapp/i18n-messages-react";
import { msgKey } from "@zodapp/i18n-messages";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  zf,
  hideSchemaFields,
  hideSchemaFieldsExcept,
  readOnlySchemaFields,
  readOnlySchemaFieldsExcept,
} from "@zodapp/zod-form";
import { SegmentedControl, Stack, Tabs, Text } from "@mantine/core";
import { IconTransform } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import { createE2eHarness } from "../../../components/E2eHarness";

export const formId = "schemaTransform";
export const title = msgKey(
  "formDemo.page.schemaTransform.title" /* i18n: スキーマ変形（ビュー派生） */,
);
export const description = msgKey(
  "formDemo.page.schemaTransform.description" /* i18n: 1つのスキーマから hideSchemaFields / readOnlySchemaFields 系で権限別ビューやタブ分割ビューを派生させる */,
);
export const icon = IconTransform;
export const category = "Advanced";

// ベーススキーマ（これが唯一の情報源）
export const schema = z
  .object({
    name: zf
      .string()
      .min(1)
      .register(zf.string.registry, {
        label: msgKey("formDemo.schemaTransform.name" /* i18n: 名前 */),
      }),
    email: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.schemaTransform.email" /* i18n: メール */),
      uiType: "email",
    }),
    plan: zf
      .enum([
        zf.literal("free").register(zf.literal.registry, { label: "Free" }),
        zf.literal("pro").register(zf.literal.registry, { label: "Pro" }),
      ])
      .register(zf.enum.registry, {
        label: msgKey("formDemo.schemaTransform.plan" /* i18n: プラン */),
      }),
    rateLimit: zf
      .number()
      .min(0)
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.schemaTransform.rateLimit" /* i18n: APIレート上限（管理者項目） */,
        ),
      }),
    internalMemo: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.schemaTransform.internalMemo" /* i18n: 社内メモ（管理者項目） */,
        ),
        uiType: "multiline",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  name: "山田 太郎",
  email: "taro@example.com",
  plan: "pro",
  rateLimit: 1000,
  internalMemo: "移行済みアカウント",
};

const ADMIN_ONLY_PATHS = ["rateLimit", "internalMemo"] as const;

type View = "admin" | "member" | "viewer" | "partial";

const viewDescriptions: Record<View, string> = {
  admin: msgKey(
    "formDemo.schemaTransform.view.admin.description" /* i18n: 管理者ビュー: ベーススキーマそのまま（全項目編集可） */,
  ),
  member: msgKey(
    "formDemo.schemaTransform.view.member.description" /* i18n: 一般ビュー: hideSchemaFields で管理者項目（rateLimit / internalMemo）を非表示 */,
  ),
  viewer: msgKey(
    "formDemo.schemaTransform.view.viewer.description" /* i18n: 閲覧ビュー: readOnlySchemaFieldsExcept([]) で全項目を読み取り専用に */,
  ),
  partial: msgKey(
    "formDemo.schemaTransform.view.partial.description" /* i18n: 一部編集ビュー: readOnlySchemaFields で name / email 以外を読み取り専用に */,
  ),
};

// 見るための部品（値・エラー・送信・ログ）。上の切り替えのフォームに置く
const harness = [createE2eHarness({ formId })];

export const Component = () => {
  const msg = useMsg();
  const [view, setView] = useState<View>("admin");

  // すべて同じ schema からの派生。元の schema は変更されない。
  const viewSchema = useMemo(() => {
    switch (view) {
      case "admin":
        return schema;
      case "member":
        return hideSchemaFields(schema, { paths: ADMIN_ONLY_PATHS });
      case "viewer":
        return readOnlySchemaFieldsExcept(schema, { paths: [] });
      case "partial":
        return readOnlySchemaFields(schema, {
          paths: ["plan", "rateLimit", "internalMemo"],
        });
    }
  }, [view]);

  // hideSchemaFieldsExcept はタブ分割にも使える
  const tabSchemas = useMemo(
    () => ({
      basic: hideSchemaFieldsExcept(schema, {
        paths: ["name", "email", "plan"],
      }),
      admin: hideSchemaFieldsExcept(schema, { paths: ADMIN_ONLY_PATHS }),
    }),
    [],
  );

  return (
    <Stack gap="lg">
      <div>
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as View)}
          data={[
            {
              value: "admin",
              label: msg(
                "formDemo.schemaTransform.view.admin" /* i18n: 管理者 */,
              ),
            },
            {
              value: "member",
              label: msg(
                "formDemo.schemaTransform.view.member" /* i18n: 一般 */,
              ),
            },
            {
              value: "viewer",
              label: msg(
                "formDemo.schemaTransform.view.viewer" /* i18n: 閲覧のみ */,
              ),
            },
            {
              value: "partial",
              label: msg(
                "formDemo.schemaTransform.view.partial" /* i18n: 一部編集 */,
              ),
            },
          ]}
        />
        <Text size="sm" c="dimmed" my="xs">
          {msg.resolve(viewDescriptions[view])}
        </Text>
        <AutoForm
          key={view}
          schema={viewSchema}
          defaultValues={defaultValues}
          actionComponents={harness}
        />
      </div>

      <div>
        <Text fw={500} mb="xs">
          {msg(
            "formDemo.schemaTransform.tabs.heading" /* i18n: hideSchemaFieldsExcept によるタブ分割（1スキーマ → 複数タブ） */,
          )}
        </Text>
        <Tabs defaultValue="basic">
          <Tabs.List>
            <Tabs.Tab value="basic">
              {msg("formDemo.schemaTransform.tabs.basic" /* i18n: 基本設定 */)}
            </Tabs.Tab>
            <Tabs.Tab value="admin">
              {msg(
                "formDemo.schemaTransform.tabs.admin" /* i18n: 管理者設定 */,
              )}
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="basic" pt="md">
            <AutoForm schema={tabSchemas.basic} defaultValues={defaultValues} />
          </Tabs.Panel>
          <Tabs.Panel value="admin" pt="md">
            <AutoForm schema={tabSchemas.admin} defaultValues={defaultValues} />
          </Tabs.Panel>
        </Tabs>
      </div>
    </Stack>
  );
};

export type SchemaType = z.infer<typeof schema>;
