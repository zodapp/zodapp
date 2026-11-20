import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/customWidget";

/** form-demo の日本語の辞書（customWidget） */
export const ja = {
  "formDemo.page.customWidget.title": "カスタムウィジェット",
  "formDemo.page.customWidget.description":
    "wrapComponent + useZodField による自作フィールドコンポーネントと、componentLibrary への {zodType}_{uiType} キーでの登録（星評価・カスケード選択）",
  "formDemo.customWidget.regionShape.prefecture": "都道府県",
  "formDemo.customWidget.regionShape.city": "市区町村",
  "formDemo.customWidget.productName": "商品名",
  "formDemo.customWidget.rating.min": "評価を選択してください",
  "formDemo.customWidget.rating": "評価（number_rating カスタムウィジェット）",
  "formDemo.customWidget.region":
    "地域（object_regionSelector カスタムウィジェット）",
  "formDemo.customWidget.region.state": "州",
  "formDemo.customWidget.region.city": "市",
} satisfies MessagesOf<typeof en>;
