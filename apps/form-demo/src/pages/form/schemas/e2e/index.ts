/**
 * e2e 用のデモページの登録簿。
 *
 * モジュールの形は、メニューに出るデモ（../index.ts の formSchemas）と同じ。
 * 詳細ページ（/form/detail?formId=…）からは開けるが、サイドバー・一覧・トップには出さない。
 * formId は `e2e-` で始める
 */
import * as e2eDynamic from "./e2eDynamic";
import * as e2eTimeInput from "./e2eTimeInput";
import * as e2ePrecision from "./e2ePrecision";

import e2eDynamicCode from "./e2eDynamic.tsx?raw";
import e2eTimeInputCode from "./e2eTimeInput.tsx?raw";
import e2ePrecisionCode from "./e2ePrecision.tsx?raw";

export const e2eSchemas = {
  [e2eDynamic.formId]: e2eDynamic,
  [e2eTimeInput.formId]: e2eTimeInput,
  [e2ePrecision.formId]: e2ePrecision,
} as const;

export const e2eCodes: Record<keyof typeof e2eSchemas, string> = {
  [e2eDynamic.formId]: e2eDynamicCode,
  [e2eTimeInput.formId]: e2eTimeInputCode,
  [e2ePrecision.formId]: e2ePrecisionCode,
};

export type E2eFormId = keyof typeof e2eSchemas;
export const e2eFormIds = Object.keys(e2eSchemas) as E2eFormId[];
