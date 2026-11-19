import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zf, defineDynamicMeta, hideSchemaFields } from "@zodapp/zod-form";
import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconFilter } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import { createE2eHarness } from "../../../components/E2eHarness";
import {
  demoValueActionResolver,
  members,
} from "../../../shared/demo/resolvers";
import {
  FetchControlPanel,
  createControlledExternalKeyResolvers,
  createFetchControl,
} from "../../../shared/demo/fetchControl";
import { TryBehavior } from "../../../shared/demo/TryBehavior";
import type { WebResolverContextMap } from "../../../shared/types/resolverContext";

export const formId = "externalKeyFilter";
export const title = "zf.externalKey（絞り込み）";
export const description =
  "ログイン中の部署などで一覧を絞る。条件を切り替えたときに一覧を取り直す。外れた値は消える（clear）か、残して「（不正な値）」とエラーを出す（keep）。複数選択の欄も同じ。「動きを試す」で、取得の時機を選ぶ・失敗させる・同じ購読のまま選択肢を 0 件にして戻す・無い topic の欄を出す";
export const icon = IconFilter;
export const category = "Advanced";

type Team = WebResolverContextMap["team"]["team"];

// 取得の時機（遅延の分け方）と失敗。「動きを試す」の枠で切り替える。既定は見やすい遅延（0.4 秒）
const control = createFetchControl();

// 「選択肢を 0 件にする」のあいだは、members の選択肢を 0 件にする
const membersState = { empty: false };

// members だけを届ける。ほかの topic は無い topic になり、購読すると失敗する
const { resolvers: externalKeyResolvers, republish } =
  createControlledExternalKeyResolvers(control, (topic) => {
    if (topic === "members") return membersState.empty ? [] : members;
    return undefined;
  });

// ============================================================
// 1. context で絞る filter
//    filter は contextId の resolverContext を受け取る。context の値は取り直しの key に入るので、
//    画面の部署を変えると選択肢を取り直す。選択肢から外れた値は消える（unlisted の既定 clear）
// ============================================================

const assignee = zf.string().register(zf.externalKey.registry, {
  label: "担当者（画面上部で選んだ部署で絞る。context の filter）",
  externalKeyConfig: {
    type: "mock",
    topic: "members",
    contextId: "team",
    filter: (option, context) => option.team === context?.team,
  },
});

// 特殊なオプション unlisted: "keep"：外れた値を消さずに残し、欄に「（不正な値）」と出してエラーにする。
// 部署を戻せば値も戻る。条件の切り替えで、選んでいた値を失いたくないときに使う
const assigneeKeep = zf.string().register(zf.externalKey.registry, {
  label: "担当者（unlisted: keep。外れた値を残し、不正な値として出す）",
  externalKeyConfig: {
    type: "mock",
    topic: "members",
    contextId: "team",
    filter: (option, context) => option.team === context?.team,
  },
  unlisted: "keep",
});

// 複数選択の欄。要素の externalKey に、単一選択と同じ filter と unlisted を書く
const watcherKey = (unlisted?: "keep") =>
  zf.string().register(zf.externalKey.registry, {
    label: "見守る人",
    externalKeyConfig: {
      type: "mock",
      topic: "members",
      contextId: "team",
      filter: (option, context) => option.team === context?.team,
    },
    unlisted,
  });

const watchers = zf.array(watcherKey()).register(zf.array.registry, {
  label: "見守る人（複数選択。画面上部で選んだ部署で絞る）",
  uiType: "multipleExternalKey",
});

const watchersKeep = zf.array(watcherKey("keep")).register(zf.array.registry, {
  label: "見守る人（複数選択。unlisted: keep）",
  uiType: "multipleExternalKey",
});

// ============================================================
// 2. dynamic で filter を差し替える
//    関数は取り直しの key に入らない（描画のたびに作り直される関数で、毎回取り直さないため）。
//    絞り方が変わるときは、その違いを config の key に書く。key が変わると取り直し、
//    選択肢から外れた値は消える
// ============================================================

const reviewer = z.string().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { reviewTeam?: Team }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => {
      const team = parent?.reviewTeam ?? "sales";
      return {
        key: team,
        schema: zf.string().register(zf.externalKey.registry, {
          label: "レビュー担当（レビューする部署で絞る）",
          externalKeyConfig: {
            type: "mock",
            topic: "members",
            filter: (option) => option.team === team,
            key: team,
          },
        }),
      };
    },
  }),
);

export const schema = z
  .object({
    assignee,
    assigneeKeep,
    watchers,
    watchersKeep,
    reviewTeam: zf
      .enum([
        zf.literal("sales").register(zf.literal.registry, { label: "営業" }),
        zf.literal("dev").register(zf.literal.registry, { label: "開発" }),
      ])
      .register(zf.enum.registry, { label: "レビューする部署" }),
    reviewer,
    // 3. 無い topic の欄。購読すると失敗して「再試行」が出て、送信を止める。
    //    「動きを試す」の「無い topic の欄を出す」をオンにしたときだけ描く
    missing: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "無い topic の欄",
        externalKeyConfig: { type: "mock", topic: "no-such-topic" },
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  assignee: "u-003",
  assigneeKeep: "u-003",
  watchers: ["u-003"],
  watchersKeep: ["u-003"],
  reviewTeam: "sales",
  reviewer: "u-003",
} satisfies z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

// 見るための部品（値・エラー・送信・ログ）
const harness = [createE2eHarness<typeof schema>({ formId })];

// 同じ購読のまま、members の選択肢を届け直す（時機は今の分け方で決める）
const setMembersEmpty = (empty: boolean) => {
  membersState.empty = empty;
  republish("members");
};

// 無い topic の欄を描かない schema（既定）
const schemaWithoutMissing = hideSchemaFields(schema, { paths: ["missing"] });

export const Component = () => {
  const [team, setTeam] = useState<Team>("sales");
  const [showMissing, setShowMissing] = useState(false);
  const resolverContext = useMemo(() => ({ team: { team } }), [team]);

  // 分け方・失敗・選択肢はページをまたいで残るので、離れるときに戻す
  useEffect(
    () => () => {
      control.reset();
      membersState.empty = false;
    },
    [],
  );

  return (
    <Stack>
      <Stack gap={4}>
        <Text size="sm">画面の部署（resolverContext の team）</Text>
        <SegmentedControl
          value={team}
          onChange={(value) => setTeam(value as Team)}
          data={[
            { label: "営業", value: "sales" },
            { label: "開発", value: "dev" },
          ]}
          data-testid="team"
        />
      </Stack>
      <TryBehavior description="選択肢が届く時機を選んだり、わざと失敗させたりできる。ふだんは「見やすい遅延」（0.4 秒）のまま使う。「選択肢を 0 件にする」「選択肢を戻す」は、購読を張り直さずに担当者・見守る人の選択肢を届け直す">
        <FetchControlPanel control={control} />
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            onClick={() => setMembersEmpty(true)}
          >
            選択肢を 0 件にする
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={() => setMembersEmpty(false)}
          >
            選択肢を戻す
          </Button>
        </Group>
        <Switch
          label="無い topic の欄を出す（出すと取得に失敗し、送信が止まる）"
          checked={showMissing}
          onChange={(event) => setShowMissing(event.currentTarget.checked)}
        />
      </TryBehavior>
      <AutoForm
        schema={showMissing ? schema : schemaWithoutMissing}
        defaultValues={defaultValues}
        resolverContext={resolverContext}
        externalKeyResolvers={externalKeyResolvers}
        valueActionResolver={demoValueActionResolver}
        actionComponents={harness}
      />
    </Stack>
  );
};
