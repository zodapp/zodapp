import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

/** `zodFormMantine.*` の日本語の辞書 */
export const ja = {
  "zodFormMantine.enum.unlisted": "選択肢に無い値です。選び直してください。",
  "zodFormMantine.enum.unlistedClearable":
    "選択肢に無い値です。選び直すか、消してください。",
  "zodFormMantine.multipleEnum.unlisted":
    "選択肢に無い値があります。消すか、選び直してください。",
  "zodFormMantine.multipleEnum.remove": ({ label }) => `${label}を外す`,
  "zodFormMantine.multipleString.placeholder": "入力してEnterで追加",
  "zodFormMantine.union.selectorLabel": "タイプ",
  "zodFormMantine.union.unselected": "選択してください",
  "zodFormMantine.union.selectOwners": ({ names }) =>
    `${names.join("と")}を選択してください`,
  "zodFormMantine.object.remove": "削除",
  "zodFormMantine.object.add": "追加",
  "zodFormMantine.object.addField": "項目を追加",
  "zodFormMantine.time.invalidFormat": ({ format }) =>
    `${format} の形で、正しい時刻を入力してください`,
  "zodFormMantine.date.monthLabelFormat": "YYYY年M月",
  "zodFormMantine.externalFile.remove": "削除",
  "zodFormMantine.externalFile.dropzone":
    "ここにファイルをドラッグ、またはクリックして選択",
  "zodFormMantine.externalFile.maxSize": "最大ファイルサイズ:",
  "zodFormMantine.record.duplicateKey": "同じキーが既に存在します",
  "zodFormMantine.record.key": "キー",
  "zodFormMantine.record.value": "値",
  "zodFormMantine.record.keyFirst": "先にキーを入力してください",
  "zodFormMantine.record.keyHeld": "キーを直すと、値が戻ります",
  "zodFormMantine.record.emptyRow": "空の行",
  "zodFormMantine.record.removeRow": ({ label }) => `${label}を削除`,
  "zodFormMantine.record.append": "末尾に追加",
  "zodFormMantine.record.addKey": "キーを追加",
  "zodFormMantine.record.unsafeKey": "キーに . [ ] は使えません",
  "zodFormMantine.record.emptyKey": "キーを入力してください",
  "zodFormMantine.record.uneditable": "このフォームでは編集できません",
  "zodFormMantine.unsafeKeyName": "このキー名は使えません",
  "zodFormMantine.unsupported":
    "このスキーマの組み合わせは、このフォームでは扱えません",
  "zodFormMantine.unsupportedSchema":
    "このスキーマは、このフォームでは扱えません",
} satisfies MessagesOf<typeof en>;
