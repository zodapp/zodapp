/**
 * e2e 用のデモページの登録簿。
 *
 * モジュールの形は、メニューに出るデモ（../index.ts の formSchemas）と同じ。
 * 詳細ページ（/form/detail?formId=…）からは開けるが、サイドバー・一覧・トップには出さない。
 * formId は `e2e-` で始める
 */

export const e2eSchemas = {} as const;

export const e2eCodes: Record<keyof typeof e2eSchemas, string> = {};

export type E2eFormId = keyof typeof e2eSchemas;
export const e2eFormIds = Object.keys(e2eSchemas) as E2eFormId[];
