/**
 * フォームのデモで使う値ごとの操作（valueAction）の型の登録
 *
 * getActionParams が返す href を、valueActionResolver がリンクにする。
 */
import type { BaseValueActionConfig } from "@zodapp/zod-form";

export type WebValueActionParams = { href: string };

export type WebValueActionConfig = BaseValueActionConfig<
  unknown,
  WebValueActionParams
>;

declare module "@zodapp/zod-form/valueAction/types" {
  interface ValueActionRegistry {
    actionConfig: WebValueActionConfig;
    actionParams: WebValueActionParams;
  }
}
