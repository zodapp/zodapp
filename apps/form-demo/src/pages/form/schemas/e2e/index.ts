/**
 * e2e 用のページ（メニューに出ない）の登録簿。
 *
 * モジュールの形は、メニューに出るデモ（../index.ts の formSchemas）と同じ。
 * 詳細ページ（/form/detail?formId=…）からは開けるが、サイドバー・一覧・トップには出さない。
 * formId は `e2e-` で始める。
 *
 * e2e で確かめたいことは、まず重なるデモページに置く（「動きを試す」の枠に操作をまとめる）。
 * ここに置くのは、デモに向かないものだけ：わざと不正な値や古い形の初期値を持つもの（e2e-open-rewrite）と、
 * 利用者が画面で触らない機能（送信する値の変換・そのまま送る型・扱えない型の注記・入れ物の refine・再帰の上限など）
 */
import * as e2eOpenRewrite from "./e2eOpenRewrite";
import * as e2eParsedSubmit from "./e2eParsedSubmit";
import * as e2ePassthrough from "./e2ePassthrough";
import * as e2eUnsupported from "./e2eUnsupported";
import * as e2eContainerRefine from "./e2eContainerRefine";
import * as e2eLazyLimit from "./e2eLazyLimit";
import * as e2eMisc from "./e2eMisc";

import e2eOpenRewriteCode from "./e2eOpenRewrite.tsx?raw";
import e2eParsedSubmitCode from "./e2eParsedSubmit.ts?raw";
import e2ePassthroughCode from "./e2ePassthrough.ts?raw";
import e2eUnsupportedCode from "./e2eUnsupported.ts?raw";
import e2eContainerRefineCode from "./e2eContainerRefine.ts?raw";
import e2eLazyLimitCode from "./e2eLazyLimit.ts?raw";
import e2eMiscCode from "./e2eMisc.ts?raw";

export const e2eSchemas = {
  [e2eOpenRewrite.formId]: e2eOpenRewrite,
  [e2eParsedSubmit.formId]: e2eParsedSubmit,
  [e2ePassthrough.formId]: e2ePassthrough,
  [e2eUnsupported.formId]: e2eUnsupported,
  [e2eContainerRefine.formId]: e2eContainerRefine,
  [e2eLazyLimit.formId]: e2eLazyLimit,
  [e2eMisc.formId]: e2eMisc,
} as const;

export const e2eCodes: Record<keyof typeof e2eSchemas, string> = {
  [e2eOpenRewrite.formId]: e2eOpenRewriteCode,
  [e2eParsedSubmit.formId]: e2eParsedSubmitCode,
  [e2ePassthrough.formId]: e2ePassthroughCode,
  [e2eUnsupported.formId]: e2eUnsupportedCode,
  [e2eContainerRefine.formId]: e2eContainerRefineCode,
  [e2eLazyLimit.formId]: e2eLazyLimitCode,
  [e2eMisc.formId]: e2eMiscCode,
};

export type E2eFormId = keyof typeof e2eSchemas;
export const e2eFormIds = Object.keys(e2eSchemas) as E2eFormId[];
