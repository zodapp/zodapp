import { useState } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import type { AutoFormAction } from "@zodapp/zod-form-widget/form";
import { Alert, Badge, Group, Stack, Text } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";

export const formId = "formActions";
export const title = "カスタムアクション";
export const description =
  "AutoForm の actions による複数ボタン（下書き保存 / 公開 / 破棄）と、フォーム状態に応じた disabled 述語";
export const icon = IconPlayerPlay;
export const category = "Advanced";

export const schema = z
  .object({
    title: zf
      .string()
      .min(1, "タイトルを入力してください")
      .register(zf.string.registry, { label: "タイトル" }),
    body: zf.string().register(zf.string.registry, {
      label: "本文",
      uiType: "multiline",
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  title: "初めての記事",
  body: "ここに本文を書きます。",
};

type SchemaType = z.infer<typeof schema>;

export const Component = () => {
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
      label: "変更を破棄",
      variant: "light",
      color: "orange",
      disabled: ({ formState }) => formState.isDefaultValue,
    },
    {
      type: "submit",
      label: "下書き保存",
      variant: "default",
      disabled: ({ formState }) => formState.isDefaultValue,
      onSubmit: (data) => {
        setDraft(data);
        setDraftVersion((version) => version + 1);
      },
    },
    {
      type: "submit",
      label: "公開する",
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
          保存 v{draftVersion}
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
        showPreview={true}
      />
      {published && (
        <Alert color="green" title="公開済みの内容">
          <Group gap="xs">
            <Badge color="green">公開中</Badge>
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
