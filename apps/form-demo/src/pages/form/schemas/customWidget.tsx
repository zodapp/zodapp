import { useResolveText } from "@zodapp/zod-form-react/common";
import { useMsg } from "@zodapp/i18n-messages-react";
import { msgKey } from "@zodapp/i18n-messages";
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
import { createE2eHarness } from "../../../components/E2eHarness";

export const formId = "customWidget";
export const title = msgKey(
  "formDemo.page.customWidget.title" /* i18n: カスタムウィジェット */,
);
export const description = msgKey(
  "formDemo.page.customWidget.description" /* i18n: wrapComponent + useZodField による自作フィールドコンポーネントと、componentLibrary への {zodType}_{uiType} キーでの登録（星評価・カスケード選択） */,
);
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
  const resolveText = useResolveText();
  const label = labelFromParent ?? resolveText(meta?.label);
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
// 2. 複合カスタムウィジェット: カスケード選択（州 → 市）
//    - object フィールド全体を1つのウィジェットが担当し、
//      サブフィールドは useZodField(パス) で個別に登録する
//    - 親の選択が変わったら子の値をリセットする
// ---------------------------------------------------------------------------

const CITY_OPTIONS: Record<string, string[]> = {
  California: ["Los Angeles", "San Francisco", "San Diego"],
  "New York": ["New York City", "Buffalo", "Rochester"],
  Texas: ["Houston", "Austin", "Dallas"],
};

const joinFieldPath = (fieldPath: string, name: string) =>
  fieldPath === "" ? name : `${fieldPath}.${name}`;

const regionShape = {
  prefecture: zf
    .string()
    .register(zf.string.registry, {
      label: msgKey(
        "formDemo.customWidget.regionShape.prefecture" /* i18n: 州 */,
      ),
    })
    .optional(),
  city: zf
    .string()
    .register(zf.string.registry, {
      label: msgKey("formDemo.customWidget.regionShape.city" /* i18n: 市 */),
    })
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
  const resolveText = useResolveText();
  const msg = useMsg();
  const label = labelFromParent ?? resolveText(meta?.label);

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
          placeholder={msg("formDemo.customWidget.region.state" /* i18n: 州 */)}
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
          placeholder={msg("formDemo.customWidget.region.city" /* i18n: 市 */)}
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
    productName: zf.string().register(zf.string.registry, {
      label: msgKey("formDemo.customWidget.productName" /* i18n: 商品名 */),
    }),
    rating: zf
      .number()
      .min(
        1,
        msgKey(
          "formDemo.customWidget.rating.min" /* i18n: 評価を選択してください */,
        ),
      )
      .max(5)
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.customWidget.rating" /* i18n: 評価（number_rating カスタムウィジェット） */,
        ),
        uiType: "rating",
      }),
    region: z.object(regionShape).register(zf.object.registry, {
      label: msgKey(
        "formDemo.customWidget.region" /* i18n: 地域（object_regionSelector カスタムウィジェット） */,
      ),
      uiType: "regionSelector",
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  productName: "Sample product",
  rating: 3,
  region: { prefecture: "California", city: "San Francisco" },
};

// 見るための部品（値・エラー・送信・ログ）
const harness = [createE2eHarness({ formId })];

export const Component = () => (
  <AutoForm
    schema={schema}
    defaultValues={defaultValues}
    componentLibrary={customComponentLibrary}
    actionComponents={harness}
  />
);

export type SchemaType = z.infer<typeof schema>;
