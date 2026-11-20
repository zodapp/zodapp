import { msgKey } from "@zodapp/i18n-messages";
import { useEffect } from "react";
import { z } from "zod";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  zf,
  type MockExternalKeyOption,
} from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { Button, Group, Stack } from "@mantine/core";
import { IconGitBranch } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import { createE2eHarness } from "../../../components/E2eHarness";
import { withFetchLog } from "../../../shared/demo/formDemoLog";
import { TryBehavior } from "../../../shared/demo/TryBehavior";

export const formId = "discriminatedUnion";
export const title = "z.discriminatedUnion";
export const description = msgKey(
  "formDemo.page.discriminatedUnion.description" /* i18n: discriminated keyを使った安定したUnion。種類を切り替えると、種類どうしで共通の項目（窓口の名前・備考）は残り、前の種類だけの項目は消えて、新しい種類の既定の値が入る。元の種類に戻しても、前の値は戻らない。選ばれていない種類の選択の欄（チャネル）は、選択肢が変わっても値を消さない */,
);
export const icon = IconGitBranch;
export const category = "Standard";

const contactSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z
          .literal("email")
          .register(zf.literal.registry, { hidden: true }),
        email: z
          .email("有効なメールアドレスを入力してください")
          .register(zf.string.registry, { label: "メール" }),
        note: zf
          .string()
          .register(zf.string.registry, { label: "備考", uiType: "multiline" }),
      })
      .register(zf.object.registry, { label: "メール連絡" }),
    z
      .object({
        type: z
          .literal("phone")
          .register(zf.literal.registry, { hidden: true }),
        phoneType: zf
          .enum([
            zf
              .literal("mobile")
              .register(zf.literal.registry, { label: "携帯電話" }),
            zf
              .literal("landline")
              .register(zf.literal.registry, { label: "固定電話" }),
          ])
          .register(zf.enum.registry, { label: "電話番号タイプ" }),
        phone: zf
          .string()
          .min(10)
          .max(15)
          .register(zf.string.registry, { label: "電話番号" }),
        note: zf
          .string()
          .register(zf.string.registry, { label: "備考", uiType: "multiline" }),
      })
      .register(zf.object.registry, { label: "電話連絡" }),
  ])
  .register(zf.union.registry, {
    label: "連絡先",
    selectorLabel: "連絡先タイプ",
  });

// 判別子（type）の無い古い形のデータに type を補う。
// 描画では preprocess を外して中の union を描き、値は先にこの変換を通して中の形にそろえる
const fillContactType = (value: unknown) => {
  if (value && typeof value === "object" && !("type" in value)) {
    return { ...value, type: "email" in value ? "email" : "phone" };
  }
  return value;
};

const legacyContactSchema = z.preprocess(
  fillContactType,
  z
    .discriminatedUnion("type", contactSchema.options)
    .register(zf.union.registry, {
      label:
        "連絡先（z.preprocess で包んだ union。初期値は type の無い古い形）",
      selectorLabel: "連絡先タイプ",
    }),
);

// ============================================================
// 種類どうしで共通の項目を持つ union（窓口）
// 種類を切り替えると、新しい種類の既定の値に、今の値のうち新しい種類にもある項目（名前・備考）を重ねる。
// 前の種類だけにあった項目は消える。オンラインのチャネルは選択肢から選ぶ欄（externalKey）
// ============================================================

const channels: MockExternalKeyOption[] = [
  { label: "チャット", value: "chat" },
  { label: "メール", value: "mail" },
];

// チャネルの選択肢。「動きを試す」のボタンで届け直す
const channelTopic = createMockTopic(channels);

const externalKeyResolvers = withFetchLog([
  createMockExternalKeyResolver({ topics: { channels: channelTopic } }),
]);

const deskCommon = {
  name: zf.string().min(1).register(zf.string.registry, { label: "名前" }),
  note: zf.string().register(zf.string.registry, { label: "備考" }).optional(),
};

const deskSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z
          .literal("store")
          .register(zf.literal.registry, { hidden: true }),
        ...deskCommon,
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
        ...deskCommon,
        url: zf.string().min(1).register(zf.string.registry, { label: "URL" }),
        channel: zf.string().register(zf.externalKey.registry, {
          label: "チャネル",
          externalKeyConfig: { type: "mock", topic: "channels" },
        }),
      })
      .register(zf.object.registry, { label: "オンライン" }),
  ])
  .register(zf.union.registry, {
    label: "窓口（種類どうしで共通の項目を持つ）",
    selectorLabel: "窓口の種類",
  });

export const schema = z
  .object({
    contact: contactSchema,
    legacyContact: legacyContactSchema,
    desk: deskSchema,
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        "Discriminated Unionは、識別子（type）によって型を判別します。通常のUnionよりパフォーマンスやメンテナンス性に優れています。",
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  contact: {
    type: "email",
    email: "du@example.com",
    note: "",
  },
  // type の無い古い形。開くと preprocess で type: "email" が補われた形で表示される
  legacyContact: { email: "legacy@example.com", note: "" },
  // 店舗で開く。オンラインのチャネルの値も持たせておく（選ばれていない種類の欄）
  desk: {
    type: "store",
    name: "本店",
    note: "",
    address: "中央区 1-1",
    channel: "chat",
  } as z.input<typeof deskSchema>,
};

export type SchemaType = z.infer<typeof schema>;

// 見るための部品（値・エラー・送信・ログ）
const harness = [createE2eHarness<typeof schema>({ formId })];

export const Component = () => {
  // topic はページをまたいで残るので、離れるときに戻す
  useEffect(() => () => channelTopic.set(channels), []);

  return (
    <Stack>
      <TryBehavior description="オンラインの窓口のチャネルの選択肢を届け直す。店舗を選んでいるあいだは、チャネルの欄は描かれていないので、値は消えない">
        <Group gap="xs">
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
      </TryBehavior>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        externalKeyResolvers={externalKeyResolvers}
        actionComponents={harness}
      />
    </Stack>
  );
};
