import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

// form-demo のキー（formDemo.*）を msg・msgKey の型に登録する
declare module "@zodapp/i18n-messages" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation のため
  interface RegisteredMessages extends MessagesOf<typeof en> {}
}
