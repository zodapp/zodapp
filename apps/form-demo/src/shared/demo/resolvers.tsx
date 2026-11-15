/**
 * フォームのデモで使う resolver（DB やルーターに依存しないモック）
 *
 * - externalKey: 下のデータを topic（createMockTopic）に入れ、createMockExternalKeyResolver で選択肢として届ける。
 *   都道府県ごとの市区町村は `cities/<都道府県>`、市区町村ごとの町名は `towns/<市区町村>` の topic にする。
 *   `members` は部署（team）を持ち、config の filter で絞り込む例に使う
 * - valueAction: getActionParams が返す href をリンクにする
 */
import { Anchor } from "@mantine/core";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  type ExternalKeyResolvers,
  type MockExternalKeyOption,
} from "@zodapp/zod-form";
import type { ValueActionResolver } from "@zodapp/zod-form-react/common";

export const users: MockExternalKeyOption[] = [
  { label: "山田 太郎", value: "u-001" },
  { label: "佐藤 花子", value: "u-002" },
  { label: "鈴木 一郎", value: "u-003" },
];

/** 部署を持つメンバー。欄に届くのは label と value だけで、team は filter で使う */
export const members: MockExternalKeyOption[] = [
  { label: "山田 太郎（営業）", value: "u-001", team: "sales" },
  { label: "鈴木 一郎（営業）", value: "u-003", team: "sales" },
  { label: "佐藤 花子（開発）", value: "u-002", team: "dev" },
  { label: "田中 次郎（開発）", value: "u-004", team: "dev" },
];

export const prefectures: MockExternalKeyOption[] = [
  { label: "東京都", value: "tokyo" },
  { label: "大阪府", value: "osaka" },
  { label: "北海道", value: "hokkaido" },
];

export const cities: Record<string, MockExternalKeyOption[]> = {
  tokyo: [
    { label: "千代田区", value: "chiyoda" },
    { label: "新宿区", value: "shinjuku" },
    { label: "渋谷区", value: "shibuya" },
  ],
  osaka: [
    { label: "大阪市", value: "osaka-shi" },
    { label: "堺市", value: "sakai" },
  ],
  hokkaido: [
    { label: "札幌市", value: "sapporo" },
    { label: "函館市", value: "hakodate" },
  ],
};

export const towns: Record<string, MockExternalKeyOption[]> = {
  chiyoda: [
    { label: "丸の内", value: "marunouchi" },
    { label: "神田", value: "kanda" },
  ],
  shinjuku: [
    { label: "西新宿", value: "nishi-shinjuku" },
    { label: "高田馬場", value: "takadanobaba" },
  ],
  shibuya: [
    { label: "道玄坂", value: "dogenzaka" },
    { label: "恵比寿", value: "ebisu" },
  ],
  "osaka-shi": [
    { label: "梅田", value: "umeda" },
    { label: "難波", value: "namba" },
  ],
  sakai: [{ label: "堺東", value: "sakaihigashi" }],
  sapporo: [
    { label: "大通", value: "odori" },
    { label: "すすきの", value: "susukino" },
  ],
  hakodate: [{ label: "元町", value: "motomachi" }],
};

const topicsOf = (
  prefix: string,
  data: Record<string, MockExternalKeyOption[]>,
) =>
  Object.fromEntries(
    Object.entries(data).map(([name, options]) => [
      `${prefix}/${name}`,
      createMockTopic(options),
    ]),
  );

export const demoTopics = {
  users: createMockTopic(users),
  members: createMockTopic(members),
  prefectures: createMockTopic(prefectures),
  // 当番。デモの画面のボタンで届け直す（購読の更新を見るため）
  onDuty: createMockTopic(users),
  ...topicsOf("cities", cities),
  ...topicsOf("towns", towns),
};

export const demoExternalKeyResolvers: ExternalKeyResolvers = [
  createMockExternalKeyResolver({ delayMs: 400, topics: demoTopics }),
];

/** 値を、getActionParams が返した href へのリンクで包む */
export const demoValueActionResolver: ValueActionResolver = ({
  value,
  actionConfig,
  resolverContext,
}) => {
  const context = actionConfig.contextId
    ? resolverContext[actionConfig.contextId]
    : undefined;
  const { href } = actionConfig.getActionParams({ value, context });
  return (children) => (
    <Anchor href={href} target="_blank" rel="noreferrer" size="sm">
      {children}
    </Anchor>
  );
};
