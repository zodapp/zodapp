import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { IconListSearch } from "@tabler/icons-react";

export const formId = "selectAndExternalKey";
export const title = "選択式と外部キー";
export const description =
  "string の選択式、値ごとの操作（valueAction）、外部キー（externalKey）と allowUnlisted、親の値で選択肢を変える外部キー";
export const icon = IconListSearch;
export const category = "Advanced";

// 値ごとの操作：getActionParams が返す href を、valueActionResolver がリンクにする
const openOffice = {
  getActionParams: ({ value }: { value: string }) => ({
    href: `https://example.com/offices/${value}`,
  }),
};
const openUser = {
  getActionParams: ({ value }: { value: string }) => ({
    href: `https://example.com/users/${value}`,
  }),
};

/**
 * 市区町村：親の都道府県で config が変わる外部キー。
 * config はただのデータなので、親の値で変えるときは dynamic で包んで externalKey の schema を返す。
 * 利用者が都道府県を変えると key が変わり、新しい選択肢に無い市区町村は消える（prune）。
 */
const citySchema = z.string().register(
  zf.dynamic.registry,
  defineDynamicMeta<unknown, { prefecture?: string }>({
    dependsOnValue: false,
    dependsOnParent: true,
    resolve: ({ parent }) => ({
      key: parent?.prefecture ?? "",
      schema: zf.string().register(zf.externalKey.registry, {
        label: "市区町村",
        externalKeyConfig: {
          type: "mock",
          source: "cities",
          params: { prefecture: parent?.prefecture },
        },
      }),
    }),
  }),
);

export const schema = z
  .object({
    // ============================================================
    // string の選択式：suggestions から選ぶ。検証は string のまま
    // ============================================================
    office: zf.string().register(zf.string.registry, {
      label: 'string + uiType: "select" + valueAction',
      uiType: "select",
      suggestions: [
        { label: "東京本社", value: "hq" },
        { label: "大阪支社", value: "osaka" },
      ],
      valueAction: openOffice,
    }),
    officeLegacy: zf.string().register(zf.string.registry, {
      label: 'string + uiType: "select"（選択肢に無い保存値もそのまま通る）',
      uiType: "select",
      suggestions: [
        { label: "東京本社", value: "hq" },
        { label: "大阪支社", value: "osaka" },
      ],
    }),
    // ============================================================
    // enum の valueAction
    // ============================================================
    status: zf
      .enum([
        zf.literal("open").register(zf.literal.registry, { label: "対応中" }),
        zf.literal("done").register(zf.literal.registry, { label: "完了" }),
      ])
      .register(zf.enum.registry, {
        label: "enum + valueAction",
        valueAction: {
          getActionParams: ({ value }) => ({
            href: `https://example.com/status/${value}`,
          }),
        },
      }),
    // ============================================================
    // externalKey：選択肢は resolver から届く（モックは 0.4 秒待つ）
    // ============================================================
    assignee: zf.string().register(zf.externalKey.registry, {
      label: "externalKey（既定：選択肢に無い値は誤り）+ valueAction",
      externalKeyConfig: { type: "mock", source: "users" },
      valueAction: openUser,
    }),
    assigneeFree: zf.string().register(zf.externalKey.registry, {
      label: "externalKey + allowUnlisted（選択肢に無い値も通す）",
      externalKeyConfig: { type: "mock", source: "users" },
      allowUnlisted: true,
    }),
    slowAssignee: zf.string().register(zf.externalKey.registry, {
      label:
        "externalKey（取得に 3 秒かかる。読み込み中は選べず、送信も止まる）",
      externalKeyConfig: { type: "mock", source: "users", delayMs: 3000 },
    }),
    // ============================================================
    // 親の値で選択肢を変える externalKey（dynamic で包む）
    // ============================================================
    prefecture: zf.string().register(zf.externalKey.registry, {
      label: "都道府県",
      externalKeyConfig: { type: "mock", source: "prefectures" },
    }),
    city: citySchema,
  })
  .register(zf.object.registry, {});

// dynamic の欄は静的には値型を持たないため、unknown 経由でキャストする
export const defaultValues = {
  office: "hq",
  officeLegacy: "closed-branch",
  status: "open",
  assignee: "u-taro",
  assigneeFree: "u-retired",
  slowAssignee: "u-sato",
  prefecture: "tokyo",
  city: "shinjuku",
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
