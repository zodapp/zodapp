import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/file";

/** form-demo の日本語の辞書（file） */
export const ja = {
  "formDemo.page.file.description":
    "ファイルを添付してプレビューする。保存先は差し替えられる",
  "formDemo.file.profileImage": "プロフィール画像",
  "formDemo.file.document": "ドキュメント",
  "formDemo.file.video": "動画ファイル",
  "formDemo.file.audio": "音声ファイル",
  "formDemo.file.anyFile": "任意のファイル",
} satisfies MessagesOf<typeof en>;
