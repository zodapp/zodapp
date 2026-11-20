import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/zodBuiltins";

/** form-demo の日本語の辞書（zodBuiltins） */
export const ja = {
  "formDemo.page.zodBuiltins.title": "zod の型をそのまま使う",
  "formDemo.page.zodBuiltins.description":
    "pipe・transform・set・map・file・readonly・数値の enum・キーの決まった record・literal・optional な再帰を、zf を使わずに書いたときの表示",
  "formDemo.zodBuiltins.treeNode.name": "名前",
  "formDemo.zodBuiltins.visibility": "公開範囲（literal の複数の値）",
  "formDemo.zodBuiltins.tags": "タグ（カンマ区切り → 配列）",
  "formDemo.zodBuiltins.channels": "通知先（Set<enum>）",
  "formDemo.zodBuiltins.keywords": "キーワード（Set<string>）",
  "formDemo.zodBuiltins.title.key.ja": "日本語",
  "formDemo.zodBuiltins.title.key.en": "英語",
  "formDemo.zodBuiltins.title": "タイトル（キーの決まった record）",
  "formDemo.zodBuiltins.priority": "優先度（数値の TS enum）",
  "formDemo.zodBuiltins.limits": "上限（Map<string, number>）",
  "formDemo.zodBuiltins.attachment": "添付（z.file()）",
  "formDemo.zodBuiltins.author.name": "著者名",
  "formDemo.zodBuiltins.author": "著者（readonly）",
  "formDemo.zodBuiltins.outline": "目次（optional な再帰）",
} satisfies MessagesOf<typeof en>;
