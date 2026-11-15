import { useMemo, useState } from "react";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { SegmentedControl, Stack, Text } from "@mantine/core";
import { IconFilter } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import {
  demoExternalKeyResolvers,
  demoValueActionResolver,
} from "../../../shared/demo/resolvers";
import type { WebResolverContextMap } from "../../../shared/types/resolverContext";

export const formId = "externalKeyFilter";
export const title = "zf.externalKey（絞り込み）";
export const description =
  "ログイン中の部署などで一覧を絞る。条件を切り替えたときに一覧を取り直す";
export const icon = IconFilter;
export const category = "Advanced";

type Team = WebResolverContextMap["team"]["team"];

// ============================================================
// 1. context で絞る filter
//    filter は contextId の resolverContext を受け取る。context の値は取り直しの key に入るので、
//    画面の部署を変えると選択肢を取り直す。context の変更は利用者の編集ではないので、
//    選択肢から外れた値は消えずに検証で止まる
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

// ============================================================
// 2. dynamic で filter だけを差し替える
//    関数は取り直しの key に入らないので、関数だけが違う config は同じ config とみなされる。
//    違いを config の key に書くと、別の config として取り直し、利用者の編集なら値を prune する
// ============================================================

const reviewerSchema = (withKey: boolean) =>
  z.string().register(
    zf.dynamic.registry,
    defineDynamicMeta<unknown, { reviewTeam?: Team }>({
      dependsOnValue: false,
      dependsOnParent: true,
      resolve: ({ parent }) => {
        const team = parent?.reviewTeam ?? "sales";
        return {
          key: team,
          schema: zf.string().register(zf.externalKey.registry, {
            label: withKey
              ? "レビュー担当（key あり：部署を変えると取り直し、選択肢に無い値を消す）"
              : "レビュー担当（key なし：部署を変えても同じ config とみなし、選択肢が変わらない）",
            externalKeyConfig: {
              type: "mock",
              topic: "members",
              filter: (option) => option.team === team,
              ...(withKey ? { key: team } : {}),
            },
          }),
        };
      },
    }),
  );

export const schema = z
  .object({
    assignee,
    reviewTeam: zf
      .enum([
        zf.literal("sales").register(zf.literal.registry, { label: "営業" }),
        zf.literal("dev").register(zf.literal.registry, { label: "開発" }),
      ])
      .register(zf.enum.registry, { label: "レビューする部署" }),
    reviewer: reviewerSchema(true),
    reviewerWithoutKey: reviewerSchema(false),
  })
  .register(zf.object.registry, {});

// dynamic の欄は静的には値型を持たないため、unknown 経由でキャストする
export const defaultValues = {
  assignee: "u-taro",
  reviewTeam: "sales",
  reviewer: "u-suzuki",
  reviewerWithoutKey: "u-suzuki",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

export const Component = () => {
  const [team, setTeam] = useState<Team>("sales");
  const resolverContext = useMemo(() => ({ team: { team } }), [team]);

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
        />
      </Stack>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        resolverContext={resolverContext}
        externalKeyResolvers={demoExternalKeyResolvers}
        valueActionResolver={demoValueActionResolver}
        showPreview={true}
      />
    </Stack>
  );
};
