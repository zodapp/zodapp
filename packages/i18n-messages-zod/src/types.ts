import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./messages/en";

declare module "@zodapp/i18n-messages" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation のため
  interface RegisteredMessages extends MessagesOf<typeof en> {}
}

/** `zod.*` の辞書の型 */
export type ZodMessages = MessagesOf<typeof en>;
