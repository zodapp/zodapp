import { z } from "zod";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  wrapComponent,
  useZodField,
  type ZodFormInternalProps,
  type ComponentLibrary,
} from "@zodapp/zod-form-react";
import { componentLibrary } from "@zodapp/zod-form-mantine";
import { Group, InputWrapper, Rating, Select } from "@mantine/core";
import { IconPuzzle } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";

export const formId = "customWidget";
export const title = "カスタムウィジェット";
export const description =
  "wrapComponent + useZodField による自作フィールドコンポーネントと、componentLibrary への {zodType}_{uiType} キーでの登録（星評価・カスケード選択）";
export const icon = IconPuzzle;
export const category = "Advanced";

// ---------------------------------------------------------------------------
// 1. 単純なカスタムウィジェット: 星評価
//    - wrapComponent が TanStack Form の field 状態（value / onChange / error）
//      を注入してくれるので、UI の描画だけを書けばよい
// ---------------------------------------------------------------------------

type NumberSchema = ReturnType<typeof zf.number>;

const RatingComponent = wrapComponent(function RatingImplement({
  schema,
  field,
  label: labelFromParent,
  readOnly,
  error,
}: ZodFormInternalProps<NumberSchema>) {
  const meta = getMeta(schema, "number");
  const label = labelFromParent ?? meta?.label;
  const value = typeof field.value === "number" ? field.value : 0;

  return (
    <InputWrapper label={label || undefined} error={error?.message}>
      <Rating
        value={value}
        onChange={(next) => field.onChange(next)}
        readOnly={readOnly || field.disabled}
        count={5}
        size="lg"
      />
    </InputWrapper>
  );
});

// ---------------------------------------------------------------------------
// 2. 複合カスタムウィジェット: カスケード選択（都道府県 → 市区町村）
//    - object フィールド全体を1つのウィジェットが担当し、
//      サブフィールドは useZodField(パス) で個別に登録する
//    - 親の選択が変わったら子の値をリセットする
// ---------------------------------------------------------------------------

const CITY_OPTIONS: Record<string, string[]> = {
  東京都: ["千代田区", "新宿区", "渋谷区"],
  大阪府: ["大阪市", "堺市", "枚方市"],
  北海道: ["札幌市", "函館市", "旭川市"],
};

const joinFieldPath = (fieldPath: string, name: string) =>
  fieldPath === "" ? name : `${fieldPath}.${name}`;

const regionShape = {
  prefecture: zf
    .string()
    .register(zf.string.registry, { label: "都道府県" })
    .optional(),
  city: zf
    .string()
    .register(zf.string.registry, { label: "市区町村" })
    .optional(),
};

type RegionSchema = z.ZodObject<typeof regionShape>;

const RegionSelectorComponent = wrapComponent(function RegionSelectorImplement({
  schema,
  fieldPath,
  label: labelFromParent,
  readOnly,
}: ZodFormInternalProps<RegionSchema>) {
  const meta = getMeta(schema, "object");
  const label = labelFromParent ?? meta?.label;

  // サブフィールドを個別に登録する。バリデーションやタッチ状態も
  // フィールド単位で管理される。
  const prefectureField = useZodField(joinFieldPath(fieldPath, "prefecture"));
  const cityField = useZodField(joinFieldPath(fieldPath, "city"));

  const prefecture =
    typeof prefectureField.state.value === "string"
      ? prefectureField.state.value
      : null;
  const city =
    typeof cityField.state.value === "string" ? cityField.state.value : null;

  return (
    <InputWrapper label={label || undefined}>
      <Group grow>
        <Select
          placeholder="都道府県"
          data={Object.keys(CITY_OPTIONS)}
          value={prefecture}
          onChange={(next) => {
            prefectureField.handleChange(next ?? undefined);
            // 親が変わったら子をリセット（カスケード）
            cityField.handleChange(undefined);
          }}
          onBlur={prefectureField.handleBlur}
          disabled={readOnly}
          clearable
        />
        <Select
          placeholder="市区町村"
          data={prefecture ? (CITY_OPTIONS[prefecture] ?? []) : []}
          value={city}
          onChange={(next) => cityField.handleChange(next ?? undefined)}
          onBlur={cityField.handleBlur}
          disabled={readOnly || !prefecture}
          clearable
        />
      </Group>
    </InputWrapper>
  );
});

// ---------------------------------------------------------------------------
// componentLibrary への登録
//   - キーは `{typeName}_{uiType}`（例: number_rating / object_regionSelector）
//   - 値は () => ({ component }) 形式。() => import("./RatingField") のように
//     dynamic import を渡せば遅延ロードされる
// ---------------------------------------------------------------------------

const customComponentLibrary: ComponentLibrary = {
  ...componentLibrary,
  number_rating: () => ({ component: RatingComponent }),
  object_regionSelector: () => ({ component: RegionSelectorComponent }),
};

export const schema = z
  .object({
    productName: zf
      .string()
      .register(zf.string.registry, { label: "商品名" }),
    rating: zf
      .number()
      .min(1, "評価を選択してください")
      .max(5)
      .register(zf.number.registry, {
        label: "評価（number_rating カスタムウィジェット）",
        uiType: "rating",
      }),
    region: z.object(regionShape).register(zf.object.registry, {
      label: "地域（object_regionSelector カスタムウィジェット）",
      uiType: "regionSelector",
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  productName: "サンプル商品",
  rating: 3,
  region: { prefecture: "東京都", city: "新宿区" },
};

export const Component = () => (
  <AutoForm
    schema={schema}
    defaultValues={defaultValues}
    componentLibrary={customComponentLibrary}
    showPreview={true}
  />
);

export type SchemaType = z.infer<typeof schema>;
