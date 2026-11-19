import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

/** zod-form-widget の日本語の辞書 */
export const ja = {
  "zodFormWidget.common.cancel": "キャンセル",

  "zodFormWidget.autoForm.submit": "保存",
  "zodFormWidget.autoForm.blocked.loading":
    "読み込み中の欄があるため、送信できませんでした",
  "zodFormWidget.autoForm.blocked.failed":
    "取得できなかった欄があるため、送信できませんでした",
  "zodFormWidget.autoForm.blocked.input":
    "入力に誤りがあるため、送信できませんでした",

  "zodFormWidget.delete.title": "削除確認",
  "zodFormWidget.delete.confirm": "削除する",
  "zodFormWidget.delete.failed": "削除に失敗しました。",
  "zodFormWidget.delete.menuItem": "削除",

  "zodFormWidget.fetchMore.emptyWithMore":
    "フィルタ条件に一致するアイテムが見つかりませんでした",
  "zodFormWidget.fetchMore.emptyNoMore":
    "アイテムがありません。新規作成してください。",
  "zodFormWidget.fetchMore.loadingTooltip": ({ scanned, filtered }) =>
    `${scanned}件をスキャン中、${filtered}件が条件に一致`,
  "zodFormWidget.fetchMore.hasMoreTooltip": ({ scanned, filtered }) =>
    `${scanned}件をスキャン済み、${filtered}件が条件に一致。続きを読み込めます。`,
  "zodFormWidget.fetchMore.doneTooltip": ({ scanned, filtered }) =>
    `全${scanned}件をスキャン、${filtered}件が条件に一致`,
  "zodFormWidget.fetchMore.loading": "読み込み中...",
  "zodFormWidget.fetchMore.loadMore": "さらに読み込む",
  "zodFormWidget.fetchMore.done": "すべて読み込みました",

  "zodFormWidget.export.title": "データエクスポート",
  "zodFormWidget.export.noData": "エクスポート対象のデータがありません。",
  "zodFormWidget.export.fetchError": ({ message }) => `取得エラー: ${message}`,
  "zodFormWidget.export.fetchFailed": "データの取得に失敗しました。",
  "zodFormWidget.export.nothingShown": "現在表示中のデータがありません。",
  "zodFormWidget.export.download": "全件取得してCSVダウンロード",
  "zodFormWidget.export.preview": ({ count }) =>
    `先頭 ${count} 件をプレビュー表示しています。`,
  "zodFormWidget.export.downloadNote":
    "ダウンロード時は全件を取得してエクスポートします。",

  "zodFormWidget.import.title": "データインポート",
  "zodFormWidget.import.selected": ({ name }) => `選択中: ${name}`,
  "zodFormWidget.import.plannedAll": ({ count }) =>
    `${count} 件を取り込み予定です（全${count}件を表示中）。`,
  "zodFormWidget.import.plannedHead": ({ count, limit }) =>
    `${count} 件を取り込み予定です（先頭 ${limit} 件を表示）。`,
  "zodFormWidget.import.importError": ({ message }) =>
    `インポートエラー: ${message}`,
  "zodFormWidget.import.importFailed": "インポートに失敗しました。",
  "zodFormWidget.import.csvSubmit": "CSVをインポート",
  "zodFormWidget.import.csvDescription":
    "CSVファイルを選択して内容を確認後に取り込みます。",
  "zodFormWidget.import.csvDropzone":
    "ここにCSVファイルをドラッグ、またはクリックして選択",
  "zodFormWidget.import.csvDropzoneHint":
    "CSV形式のファイルを1つ選択してください",
  "zodFormWidget.import.csvNoRows": "CSVにデータ行がありません。",
  "zodFormWidget.import.csvNothingToImport":
    "CSVから取り込めるデータがありません。",
  "zodFormWidget.import.csvParseError": ({ message }) =>
    `CSV解析エラー: ${message}`,
  "zodFormWidget.import.csvParseFailed": "CSVの解析に失敗しました。",
  "zodFormWidget.import.csvSelectFile": "CSVファイルを選択してください。",
  "zodFormWidget.import.csvEmpty": "まだCSVが選択されていません。",
  "zodFormWidget.import.fileSubmit": "データをインポート",
  "zodFormWidget.import.fileDescription":
    "ファイルを選択して内容を確認後に取り込みます。",
  "zodFormWidget.import.selectFile": "ファイルを選択",
  "zodFormWidget.import.fileEmpty": "まだファイルが選択されていません。",
  "zodFormWidget.import.parseError": ({ message }) => `解析エラー: ${message}`,
  "zodFormWidget.import.parseFailed": "ファイルの解析に失敗しました。",

  "zodFormWidget.tabular.emptyFile": "CSVファイルが空です。",
  "zodFormWidget.tabular.noHeader": "CSVヘッダーが見つかりません。",
  "zodFormWidget.tabular.noRows": "CSVにデータ行がありません。",

  "zodFormWidget.table.sort": ({ label }) => `${label}を並び替え`,
  "zodFormWidget.table.scrollToTop": "一覧の先頭へ移動",
  "zodFormWidget.table.scrollToBottom": "一覧の末尾へ移動",

  "zodFormWidget.tableSetting.title": "テーブル設定",
  "zodFormWidget.tableSetting.recordOptionGroup": "入力候補",
  "zodFormWidget.tableSetting.width": "幅",
  "zodFormWidget.tableSetting.otherScope": "その他",
  "zodFormWidget.tableSetting.defaultProfile": "デフォルト",
  "zodFormWidget.tableSetting.duplicateName":
    "選択した保存先に同名のプロフィールが既に存在します",
  "zodFormWidget.tableSetting.editing": "編集中",
  "zodFormWidget.tableSetting.discard": "編集を破棄",
  "zodFormWidget.tableSetting.deleteProfile": "プロフィールを削除",
  "zodFormWidget.tableSetting.readOnly": "読み込み専用",
  "zodFormWidget.tableSetting.saveAs": "別名で保存",
  "zodFormWidget.tableSetting.overwrite": "上書き保存",
  "zodFormWidget.tableSetting.saveConfirmTitle": "保存の確認",
  "zodFormWidget.tableSetting.saveConfirm": ({ scope, name }) =>
    `${scope}の設定「${name}」に上書き保存しますか？`,
  "zodFormWidget.tableSetting.profileName": "プロフィール名",
  "zodFormWidget.tableSetting.namePlaceholder": "名前を入力",
  "zodFormWidget.tableSetting.saveTo": "保存先",
  "zodFormWidget.tableSetting.save": "保存",
  "zodFormWidget.tableSetting.deleteConfirmTitle": "削除の確認",
  "zodFormWidget.tableSetting.deleteConfirm": ({ scope, name }) =>
    `${scope}の設定「${name}」を削除しますか？この操作は取り消せません。`,
  "zodFormWidget.tableSetting.delete": "削除",
} satisfies MessagesOf<typeof en>;
