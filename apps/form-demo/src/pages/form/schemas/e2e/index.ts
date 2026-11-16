/**
 * e2e 用のデモページの登録簿。
 *
 * モジュールの形は、メニューに出るデモ（../index.ts の formSchemas）と同じ。
 * 詳細ページ（/form/detail?formId=…）からは開けるが、サイドバー・一覧・トップには出さない。
 * formId は `e2e-` で始める。
 *
 * e2e で確かめたいことは、まず重なるデモページに置く（「動きを試す」の枠に操作をまとめる）。
 * ここに置くのは、デモに向かないものだけ（わざと不正な値や古い形の初期値を持つ e2e-open-rewrite）
 */
import * as e2eOpenRewrite from "./e2eOpenRewrite";

import e2eOpenRewriteCode from "./e2eOpenRewrite.tsx?raw";

export const e2eSchemas = {
  [e2eOpenRewrite.formId]: e2eOpenRewrite,
} as const;

export const e2eCodes: Record<keyof typeof e2eSchemas, string> = {
  [e2eOpenRewrite.formId]: e2eOpenRewriteCode,
};

export type E2eFormId = keyof typeof e2eSchemas;
export const e2eFormIds = Object.keys(e2eSchemas) as E2eFormId[];
