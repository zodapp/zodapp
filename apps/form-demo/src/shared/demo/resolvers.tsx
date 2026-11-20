/**
 * フォームのデモで使う resolver（DB やルーターに依存しないモック）
 *
 * - externalKey: 下のデータを topic（createMockTopic）に入れ、createMockExternalKeyResolver で選択肢として届ける。
 *   住所の連動は、データの種別ごとにフラットな topic にする。米国は `states_us` → `cities_us/<州>` → `neighborhoods_us/<市>`、
 *   日本は `prefectures_jp` → `cities_jp/<都道府県>` → `towns_jp/<市区町村>`。
 *   親が空のとき（`cities_us/`・`towns_jp/` など）は、空の topic で 0 件の選択肢を届ける（無い topic は失敗になるため）。
 *   `members` は部署（team）を持ち、config の filter で絞り込む例に使う。
 *   モックは待たずに届けるので、読み込み中を見せるためにデモの側で包んで遅らせる（withDemoDelay）
 * - valueAction: getActionParams が返す href をリンクにする
 */
import { Anchor } from "@mantine/core";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  type ExternalKeyResolverEntry,
  type ExternalKeyResolvers,
  type MockExternalKeyOption,
} from "@zodapp/zod-form";
import type { ValueActionResolver } from "@zodapp/zod-form-react/common";
import type { WebExternalKeyConfig } from "../types/externalKeyConfig";
import { withFetchLog } from "./formDemoLog";

export const users: MockExternalKeyOption[] = [
  { label: "Alice Johnson", value: "u-001" },
  { label: "Bob Smith", value: "u-002" },
  { label: "Carol Davis", value: "u-003" },
];

/** メールアドレスを値に持つ利用者（externalKey の土台に z.email() を使う例） */
export const userEmails: MockExternalKeyOption[] = [
  { label: "Alice Johnson", value: "alice@example.com" },
  { label: "Bob Smith", value: "bob@example.com" },
];

/** 部署を持つメンバー。欄に届くのは label と value だけで、team は filter で使う */
export const members: MockExternalKeyOption[] = [
  { label: "Alice Johnson (Sales)", value: "u-001", team: "sales" },
  { label: "Carol Davis (Sales)", value: "u-003", team: "sales" },
  { label: "Bob Smith (Dev)", value: "u-002", team: "dev" },
  { label: "Dan Miller (Dev)", value: "u-004", team: "dev" },
];

// ============================================================
// 住所の連動（米国）：州 → 市 → 地区
// ============================================================

export const statesUs: MockExternalKeyOption[] = [
  { label: "California", value: "ca" },
  { label: "New York", value: "ny" },
  { label: "Texas", value: "tx" },
];

export const citiesUs: Record<string, MockExternalKeyOption[]> = {
  ca: [
    { label: "Los Angeles", value: "los-angeles" },
    { label: "San Francisco", value: "san-francisco" },
    { label: "San Diego", value: "san-diego" },
  ],
  ny: [
    { label: "New York City", value: "new-york-city" },
    { label: "Buffalo", value: "buffalo" },
  ],
  tx: [
    { label: "Houston", value: "houston" },
    { label: "Austin", value: "austin" },
  ],
};

export const neighborhoodsUs: Record<string, MockExternalKeyOption[]> = {
  "los-angeles": [
    { label: "Hollywood", value: "hollywood" },
    { label: "Venice", value: "venice" },
  ],
  "san-francisco": [
    { label: "Mission District", value: "mission" },
    { label: "SoMa", value: "soma" },
  ],
  "san-diego": [
    { label: "La Jolla", value: "la-jolla" },
    { label: "Gaslamp Quarter", value: "gaslamp" },
  ],
  "new-york-city": [
    { label: "Manhattan", value: "manhattan" },
    { label: "Brooklyn", value: "brooklyn" },
  ],
  buffalo: [{ label: "Elmwood Village", value: "elmwood" }],
  houston: [
    { label: "Midtown", value: "midtown" },
    { label: "Montrose", value: "montrose" },
  ],
  austin: [{ label: "Downtown", value: "downtown" }],
};

// ============================================================
// 住所の連動（日本）：都道府県 → 市区町村 → 町名。言語を切り替えても日本語のまま出すサンプル
// ============================================================

export const prefecturesJp: MockExternalKeyOption[] = [
  { label: "東京都", value: "tokyo" },
  { label: "大阪府", value: "osaka" },
  { label: "北海道", value: "hokkaido" },
];

export const citiesJp: Record<string, MockExternalKeyOption[]> = {
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

export const townsJp: Record<string, MockExternalKeyOption[]> = {
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

/**
 * 住所の連動の選択肢を topic の名前で引く。親が空のとき（`cities_us/` など）は 0 件、
 * 住所の topic でなければ undefined
 */
export const addressOptionsOf = (
  topic: string,
): MockExternalKeyOption[] | undefined => {
  if (topic === "states_us") return statesUs;
  if (topic === "prefectures_jp") return prefecturesJp;
  const [kind, name = ""] = topic.split("/");
  const table: Record<string, Record<string, MockExternalKeyOption[]>> = {
    cities_us: citiesUs,
    neighborhoods_us: neighborhoodsUs,
    cities_jp: citiesJp,
    towns_jp: townsJp,
  };
  const data = kind === undefined ? undefined : table[kind];
  if (!data) return undefined;
  return name ? data[name] : [];
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
  userEmails: createMockTopic(userEmails),
  // 当番。デモの画面のボタンで届け直す（購読の更新を見るため）
  onDuty: createMockTopic(users),
  states_us: createMockTopic(statesUs),
  ...topicsOf("cities_us", citiesUs),
  ...topicsOf("neighborhoods_us", neighborhoodsUs),
  prefectures_jp: createMockTopic(prefecturesJp),
  ...topicsOf("cities_jp", citiesJp),
  ...topicsOf("towns_jp", townsJp),
  // 親が空のときの topic。0 件の選択肢を届け、欄に「選択肢がありません」（emptyMessage）を出す
  "cities_us/": createMockTopic<MockExternalKeyOption[]>([]),
  "neighborhoods_us/": createMockTopic<MockExternalKeyOption[]>([]),
  "cities_jp/": createMockTopic<MockExternalKeyOption[]>([]),
  "towns_jp/": createMockTopic<MockExternalKeyOption[]>([]),
};

/**
 * resolver を包み、購読を始めるまで待たせる。人が読み込み中を見られるようにするためのもので、
 * 待つ時間は config の `demoDelayMs`（無ければ defaultMs）。テストはこの時間に頼らない
 */
export const withDemoDelay = (
  entry: ExternalKeyResolverEntry<"mock", WebExternalKeyConfig>,
  defaultMs: number,
): ExternalKeyResolverEntry<"mock", WebExternalKeyConfig> => ({
  type: entry.type,
  resolver: (config, resolverContext) => ({
    subscribe: (callback, onError) => {
      let unsubscribe: (() => void) | undefined;
      const timer = setTimeout(() => {
        unsubscribe = entry
          .resolver(config, resolverContext)
          .subscribe(callback, onError);
      }, config.demoDelayMs ?? defaultMs);
      return () => {
        clearTimeout(timer);
        unsubscribe?.();
      };
    },
  }),
});

// 購読・届いた選択肢・失敗は、見るための部品のログに書く
export const demoExternalKeyResolvers: ExternalKeyResolvers = withFetchLog([
  withDemoDelay(createMockExternalKeyResolver({ topics: demoTopics }), 400),
]);

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
