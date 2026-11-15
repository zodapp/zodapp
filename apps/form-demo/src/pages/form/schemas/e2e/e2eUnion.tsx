import { useEffect } from "react";
import { z } from "zod";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  zf,
  type MockExternalKeyOption,
} from "@zodapp/zod-form";
import { Button, Group, Stack, Text } from "@mantine/core";
import { IconTestPipe } from "@tabler/icons-react";

import { AutoForm } from "../../../../components/AutoForm";
import { createE2eHarness } from "../../../../components/E2eHarness";
import { withFetchLog } from "../../../../shared/demo/formDemoLog";

export const formId = "e2e-union";
export const title = "e2e：union の腕の切り替え";
export const description =
  "窓口の種類（店舗・オンライン）で腕が変わる。腕を切り替えると、共通の項目（名前・備考）は残り、前の腕だけの項目は消え、新しい腕の既定の値が入る。元の腕に戻すと、前の腕だけの項目は既定の値に戻る。選ばれていない腕の選択の欄（チャネル）は、選択肢が変わっても消さない";
export const icon = IconTestPipe;
export const category = "e2e";

const channels: MockExternalKeyOption[] = [
  { label: "チャット", value: "chat" },
  { label: "メール", value: "mail" },
];

const channelTopic = createMockTopic(channels);

const externalKeyResolvers = withFetchLog([
  createMockExternalKeyResolver({ topics: { channels: channelTopic } }),
]);

const common = {
  name: zf.string().min(1).register(zf.string.registry, { label: "名前" }),
  note: zf.string().register(zf.string.registry, { label: "備考" }).optional(),
};

export const schema = z
  .object({
    desk: z
      .discriminatedUnion("type", [
        z
          .object({
            type: z
              .literal("store")
              .register(zf.literal.registry, { hidden: true }),
            ...common,
            address: zf
              .string()
              .min(1)
              .register(zf.string.registry, { label: "住所" }),
          })
          .register(zf.object.registry, { label: "店舗" }),
        z
          .object({
            type: z
              .literal("online")
              .register(zf.literal.registry, { hidden: true }),
            ...common,
            url: zf
              .string()
              .min(1)
              .register(zf.string.registry, { label: "URL" }),
            channel: zf.string().register(zf.externalKey.registry, {
              label: "チャネル",
              externalKeyConfig: { type: "mock", topic: "channels" },
            }),
          })
          .register(zf.object.registry, { label: "オンライン" }),
      ])
      .register(zf.union.registry, {
        label: "窓口",
        selectorLabel: "窓口の種類",
      }),
  })
  .register(zf.object.registry, {});

// 店舗の腕で開く。オンラインの腕のチャネルの値も持たせておく（選ばれていない腕の欄）
export const defaultValues = {
  desk: {
    type: "store",
    name: "本店",
    note: "",
    address: "中央区 1-1",
    channel: "chat",
  },
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

const harness = [createE2eHarness<typeof schema>({ formId })];

export const Component = () => {
  // topic はページをまたいで残るので、離れるときに戻す
  useEffect(() => () => channelTopic.set(channels), []);

  return (
    <Stack>
      <Group gap="xs">
        <Text size="sm">チャネルの選択肢</Text>
        <Button
          size="xs"
          variant="default"
          onClick={() =>
            channelTopic.set(channels.filter((c) => c.value !== "chat"))
          }
        >
          チャットを選択肢から外す
        </Button>
        <Button
          size="xs"
          variant="default"
          onClick={() => channelTopic.set(channels)}
        >
          選択肢を戻す
        </Button>
      </Group>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        externalKeyResolvers={externalKeyResolvers}
        actionComponents={harness}
      />
    </Stack>
  );
};
