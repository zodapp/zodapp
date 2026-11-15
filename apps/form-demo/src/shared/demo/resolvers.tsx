/**
 * フォームのデモで使う resolver（DB やルーターに依存しないモック）
 *
 * - externalKey: createMockExternalKeyResolver で、下の固定データから選択肢を返す
 * - valueAction: getActionParams が返す href をリンクにする
 */
import { Anchor } from "@mantine/core";
import {
  createMockExternalKeyResolver,
  type ExternalKeyResolvers,
  type MockExternalKeyOption,
} from "@zodapp/zod-form";
import type { ValueActionResolver } from "@zodapp/zod-form-react/common";

export const users: MockExternalKeyOption[] = [
  { label: "山田 太郎", value: "u-taro" },
  { label: "佐藤 花子", value: "u-sato" },
  { label: "鈴木 一郎", value: "u-suzuki" },
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

export const demoExternalKeyResolvers: ExternalKeyResolvers = [
  createMockExternalKeyResolver({
    delayMs: 400,
    sources: {
      users: () => users,
      // 届けるたびに一人ずつ外れる（購読の更新を見るため）
      onDuty: (_params, tick) =>
        users.filter((_, i) => i !== tick % users.length),
      prefectures: () => prefectures,
      cities: ({ prefecture }) => cities[String(prefecture)] ?? [],
      towns: ({ city }) => towns[String(city)] ?? [],
    },
  }),
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
