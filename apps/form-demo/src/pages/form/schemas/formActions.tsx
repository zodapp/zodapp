import { useMsg } from "@zodapp/i18n-messages-react";
import { msgKey } from "@zodapp/i18n-messages";
import { useState } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import type { AutoFormAction } from "@zodapp/zod-form-widget/form";
import { Alert, Badge, Group, Stack, Text } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import { createE2eHarness } from "../../../components/E2eHarness";

export const formId = "formActions";
export const title = msgKey(
  "formDemo.page.formActions.title" /* i18n: カスタムアクション */,
);
export const description = msgKey(
  "formDemo.page.formActions.description" /* i18n: AutoForm の actions による複数ボタン（下書き保存 / 公開 / 破棄）と、フォーム状態に応じた disabled 述語 */,
);
export const icon = IconPlayerPlay;
export const category = "Advanced";

export const schema = z
  .object({
    title: zf
      .string()
      .min(
        1,
        msgKey(
          "formDemo.formActions.title.min" /* i18n: タイトルを入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey("formDemo.formActions.title" /* i18n: タイトル */),
      }),
    body: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.formActions.body" /* i18n: 本文 */),
      uiType: "multiline",
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  title: "My first article",
  body: "Write the body here.",
};

type SchemaType = z.infer<typeof schema>;

// 見るための部品。このページは actions のボタンが主題なので、部品の「送信」は出さない
const harness = [createE2eHarness<typeof schema>({ formId, submit: false })];

export const Component = () => {
  const msg = useMsg();
  // 下書きとして保存済みの値。AutoForm の defaultValues に渡すことで、
  // 「保存済みの状態と等しいか」を formState.isDefaultValue で判定できる。
  const [draft, setDraft] = useState<z.input<typeof schema>>(defaultValues);
  const [draftVersion, setDraftVersion] = useState(0);
  const [published, setPublished] = useState<SchemaType>();

  // actions の disabled / hidden / loading には値のほか、
  // ({ formState }) => boolean の述語を渡せる。
  // - 破棄: 変更がなければ押せない
  // - 下書き保存: 変更がなければ押せない
  // - 公開: 未保存の変更があるうちは押せない（先に保存させる）
  const actions: readonly AutoFormAction<typeof schema>[] = [
    {
      type: "reset",
      label: msg("formDemo.formActions.actions.reset" /* i18n: 変更を破棄 */),
      variant: "light",
      color: "orange",
      disabled: ({ formState }) => formState.isDefaultValue,
    },
    {
      type: "submit",
      label: msg(
        "formDemo.formActions.actions.saveDraft" /* i18n: 下書き保存 */,
      ),
      variant: "default",
      disabled: ({ formState }) => formState.isDefaultValue,
      onSubmit: (data) => {
        setDraft(data);
        setDraftVersion((version) => version + 1);
      },
    },
    {
      type: "submit",
      label: msg("formDemo.formActions.actions.publish" /* i18n: 公開する */),
      color: "green",
      disabled: ({ formState }) => !formState.isDefaultValue,
      onSubmit: (data) => {
        setPublished(data);
      },
    },
    {
      // type: "custom" は任意の ReactNode を描画できる
      type: "custom",
      render: () => (
        <Text size="sm" c="dimmed">
          {msg(
            "formDemo.formActions.actions.savedVersion" /* i18n: 保存 v${version} */,
            { version: String(draftVersion) },
          )}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <AutoForm
        key={draftVersion}
        schema={schema}
        defaultValues={draft}
        actions={actions}
        actionComponents={harness}
      />
      {published && (
        <Alert
          color="green"
          title={msg(
            "formDemo.formActions.published.title" /* i18n: 公開済みの内容 */,
          )}
        >
          <Group gap="xs">
            <Badge color="green">
              {msg("formDemo.formActions.published.badge" /* i18n: 公開中 */)}
            </Badge>
            <Text size="sm">{published.title}</Text>
          </Group>
          <Text size="sm" c="dimmed">
            {published.body}
          </Text>
        </Alert>
      )}
    </Stack>
  );
};

export type { SchemaType };
