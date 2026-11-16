/**
 * e2e 用のデモページの登録簿。
 *
 * モジュールの形は、メニューに出るデモ（../index.ts の formSchemas）と同じ。
 * 詳細ページ（/form/detail?formId=…）からは開けるが、サイドバー・一覧・トップには出さない。
 * formId は `e2e-` で始める
 */
import * as e2eExternalKey from "./e2eExternalKey";
import * as e2eOpenRewrite from "./e2eOpenRewrite";
import * as e2eTable from "./e2eTable";

import e2eExternalKeyCode from "./e2eExternalKey.tsx?raw";
import e2eOpenRewriteCode from "./e2eOpenRewrite.tsx?raw";
import e2eTableCode from "./e2eTable.tsx?raw";

export const e2eSchemas = {
  [e2eExternalKey.formId]: e2eExternalKey,
  [e2eOpenRewrite.formId]: e2eOpenRewrite,
  [e2eTable.formId]: e2eTable,
} as const;

export const e2eCodes: Record<keyof typeof e2eSchemas, string> = {
  [e2eExternalKey.formId]: e2eExternalKeyCode,
  [e2eOpenRewrite.formId]: e2eOpenRewriteCode,
  [e2eTable.formId]: e2eTableCode,
};

export type E2eFormId = keyof typeof e2eSchemas;
export const e2eFormIds = Object.keys(e2eSchemas) as E2eFormId[];
