import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/app";

/** form-demo の日本語の辞書（app） */
export const ja = {
  "formDemo.app.home.tagline": "AIネイティブなスキーマ駆動開発フレームワーク",
  "formDemo.app.home.features": "特徴",
  "formDemo.app.home.schemaFirst.title": "スキーマファースト開発",
  "formDemo.app.home.schemaFirst.body":
    "一つのスキーマから型定義・フォームUI・DynamoDB 連携を自動生成。",
  "formDemo.app.home.metadata.title": "メタデータ拡張システム",
  "formDemo.app.home.metadata.body":
    "Zodスキーマをベースに、ラベル、表示オプションなどのUI情報をスキーマに付与することで、Zodのエコシステムを最大限に活かします。",
  "formDemo.app.home.aiNative.title": "AIネイティブ設計",
  "formDemo.app.home.aiNative.body":
    "複数のスキーマの関係性を確認することを不要にし、AI開発の効率を最大限に高めるとともに、AIコーディングの結果を人間がレビューするのを格段に容易にします。AIコーディング時代の開発フレームワークです。",
  "formDemo.app.home.demos": "収録デモ",
  "formDemo.app.demo.form.label": "フォーム",
  "formDemo.app.demo.form.title": "フォームデモ",
  "formDemo.app.demo.form.description":
    "1 つの Zod スキーマから生成されるフォーム UI のカタログ。入力型・レイアウト・カスタムウィジェット・動的スキーマなど。",
  "formDemo.app.list.title": "スキーマ一覧",
  "formDemo.app.list.description":
    "Zodスキーマから自動生成されるフォームのサンプル集です。カードをクリックして詳細を確認できます。",
  "formDemo.app.nav.backToTop": "トップに戻る",
  "formDemo.app.nav.list": "一覧",
  "formDemo.app.nav.schemas": "スキーマ一覧",
  "formDemo.app.layout.closeSidebar": "サイドバーを閉じる",
  "formDemo.app.layout.openSidebar": "サイドバーを開く",
  "formDemo.app.detail.tabForm": "表示",
  "formDemo.app.detail.tabCode": "コード",
  "formDemo.app.harness.submit": "送信",
  "formDemo.app.harness.submitted": ({ count }) => `送信: ${count} 回`,
  "formDemo.app.harness.submittedValues": ({ values }) =>
    `（送信した値: ${values}）`,
  "formDemo.app.harness.errors": "エラー:",
  "formDemo.app.harness.noErrors": "なし",
  "formDemo.app.harness.formError": ({ message }) => `（全体）${message}`,
  "formDemo.app.harness.errorSeparator": "、",
  "formDemo.app.harness.log": ({ count }) => `ログ（${count} 件）`,
  "formDemo.app.harness.unnamed": "（名前なし）",
  "formDemo.app.harness.logValue": ({ changes }) => `値: ${changes}`,
  "formDemo.app.harness.logFetch": ({ kind, field, key, result }) =>
    `取得（${kind}）: ${field} key=${key} ${result}`,
  "formDemo.app.harness.fetch.called": "呼ばれた",
  "formDemo.app.harness.fetch.delivered": "届いた",
  "formDemo.app.harness.fetch.failed": "失敗した",
  "formDemo.app.harness.logDynamic": ({ statuses }) =>
    `dynamic の状態: ${statuses}`,
  "formDemo.app.harness.noDynamic": "読み込み中・失敗の欄なし",
  "formDemo.app.harness.logSubmit": ({ result }) => `送信: ${result}`,
  "formDemo.app.harness.submit.attempted": "試みた",
  "formDemo.app.harness.submit.passed": "通った",
  "formDemo.app.harness.submit.blocked": "止まった",
  "formDemo.app.nav.top": "トップ",
} satisfies MessagesOf<typeof en>;
