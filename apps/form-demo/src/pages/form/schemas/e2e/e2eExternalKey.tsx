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
import { IconTestPipe } from "@tabler/icons-react";

import { AutoForm } from "../../../../components/AutoForm";
import { createE2eHarness } from "../../../../components/E2eHarness";
import { members } from "../../../../shared/demo/resolvers";
import type { WebResolverContextMap } from "../../../../shared/types/resolverContext";
import {
  FetchControlPanel,
  createControlledExternalKeyResolvers,
  createFetchControl,
} from "./fetchControl";

export const formId = "e2e-external-key";
export const title = "e2e：選択肢の届き方";
export const description =
  "画面の部署で絞る担当者（clear と keep）、config の key で取り直すレビュー担当、無い topic の欄（「無い topic の欄を出す」で出す）、上限が変わる数量の欄。遅延の分け方を選び、止めておく分け方では「届ける」「失敗させる」で進める。「選択肢を 0 件にする」「選択肢を戻す」で、同じ購読のまま選択肢を届け直す";
export const icon = IconTestPipe;
export const category = "e2e";

type Team = WebResolverContextMap["team"]["team"];

const control = createFetchControl();

// 「選択肢を 0 件にする」のあいだは、members の選択肢を 0 件にする
const membersState = { empty: false };

const { resolvers: externalKeyResolvers, republish } =
  createControlledExternalKeyResolvers(control, (topic) => {
    if (topic === "members") return membersState.empty ? [] : members;
    return undefined;
  });

// 数量の上限。ボタンで 1 回ずつ変え、同じ購読のまま schema を届け直す
const limitStore = (() => {
  let limit = 10;
  const listeners = new Set<() => void>();
  return {
    get: () => limit,
    set: (next: number) => {
      limit = next;
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

const assignee = zf.string().register(zf.externalKey.registry, {
  label: "担当者（部署で絞る。clear）",
  externalKeyConfig: {
    type: "mock",
    topic: "members",
    contextId: "team",
    filter: (option, context) => option.team === context?.team,
  },
});

const assigneeKeep = zf.string().register(zf.externalKey.registry, {
  label: "担当者（部署で絞る。keep）",
  externalKeyConfig: {
    type: "mock",
    topic: "members",
    contextId: "team",
    filter: (option, context) => option.team === context?.team,
  },
  unlisted: "keep",
});

// config の key で取り直す（filter の関数だけが違うので、違いを key に書く）
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
          label: "レビュー担当（レビューする部署で絞る。config の key）",
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

// 上限が変わる数量。値は消さず、上限を超えたときだけエラーにする
const quantity = z.number().register(
  zf.dynamic.registry,
  defineDynamicMeta({
    dependsOnValue: false,
    resolve: () => ({
      key: "limit",
      subscribe: (emit) => {
        const send = () => {
          const limit = limitStore.get();
          emit({
            key: "limit",
            schema: zf
              .number()
              .max(limit, `上限（${limit}）を超えています`)
              .register(zf.number.registry, {
                label: `数量（上限 ${limit}）`,
              }),
          });
        };
        send();
        return limitStore.subscribe(send);
      },
    }),
  }),
);

export const schema = z
  .object({
    assignee,
    assigneeKeep,
    reviewTeam: zf
      .enum([
        zf.literal("sales").register(zf.literal.registry, { label: "営業" }),
        zf.literal("dev").register(zf.literal.registry, { label: "開発" }),
      ])
      .register(zf.enum.registry, { label: "レビューする部署" }),
    reviewer,
    // 無い topic の欄。購読すると失敗になり、送信を止めるので、スイッチで出したときだけ描く
    missing: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "無い topic の欄",
        externalKeyConfig: { type: "mock", topic: "no-such-topic" },
      })
      .optional(),
    quantity,
  })
  .register(zf.object.registry, {});

// dynamic の欄は静的には値型を持たないため、unknown 経由でキャストする
export const defaultValues = {
  assignee: "u-003",
  assigneeKeep: "u-003",
  reviewTeam: "sales",
  reviewer: "u-003",
  quantity: 5,
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

const harness = [createE2eHarness<typeof schema>({ formId })];

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

  // 分け方・失敗・選択肢・上限はページをまたいで残るので、離れるときに戻す
  useEffect(
    () => () => {
      control.reset();
      membersState.empty = false;
      limitStore.set(10);
    },
    [],
  );

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        手順：遅延の分け方を選んでから、画面の部署やレビューする部署を変える。止めておく分け方では、待っている取得の「届ける」「失敗させる」で進める
      </Text>
      <FetchControlPanel control={control} />
      <Group gap="sm">
        <Text size="sm">画面の部署（resolverContext の team）</Text>
        <SegmentedControl
          size="xs"
          value={team}
          onChange={(value) => setTeam(value as Team)}
          data={[
            { label: "営業", value: "sales" },
            { label: "開発", value: "dev" },
          ]}
          data-testid="team"
        />
      </Group>
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
        <Button size="xs" variant="default" onClick={() => limitStore.set(3)}>
          上限を 3 にする
        </Button>
        <Button size="xs" variant="default" onClick={() => limitStore.set(10)}>
          上限を 10 にする
        </Button>
      </Group>
      <Switch
        label="無い topic の欄を出す（出すと取得に失敗し、送信が止まる）"
        checked={showMissing}
        onChange={(event) => setShowMissing(event.currentTarget.checked)}
      />
      <AutoForm
        schema={showMissing ? schema : schemaWithoutMissing}
        defaultValues={defaultValues}
        resolverContext={resolverContext}
        externalKeyResolvers={externalKeyResolvers}
        actionComponents={harness}
      />
    </Stack>
  );
};
