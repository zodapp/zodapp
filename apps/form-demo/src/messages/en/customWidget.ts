import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（customWidget） */
export const en = defineMessages({
  "formDemo.page.customWidget.title": "Custom widgets",
  "formDemo.page.customWidget.description":
    "Custom field components built with wrapComponent + useZodField, registered in componentLibrary with {zodType}_{uiType} keys (star rating, cascading select)",
  "formDemo.customWidget.regionShape.prefecture": "State",
  "formDemo.customWidget.regionShape.city": "City",
  "formDemo.customWidget.productName": "Product name",
  "formDemo.customWidget.rating.min": "Please choose a rating",
  "formDemo.customWidget.rating": "Rating (number_rating custom widget)",
  "formDemo.customWidget.region":
    "Region (object_regionSelector custom widget)",
  "formDemo.customWidget.region.state": "State",
  "formDemo.customWidget.region.city": "City",
});
