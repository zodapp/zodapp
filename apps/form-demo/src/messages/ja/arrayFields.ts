import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/arrayFields";

/** form-demo の日本語の辞書（arrayFields） */
export const ja = {
  "formDemo.page.arrayFields.description": "行を追加・削除しながら入力する",
  "formDemo.arrayFields.friendTableItemSchema.name": "名前",
  "formDemo.arrayFields.friendTableItemSchema.comment": "コメント",
  "formDemo.arrayFields.friendTableItemSchema.age": "年齢",
  "formDemo.arrayFields.friendTableItemSchema.isMember": "会員",
  "formDemo.arrayFields.friendTableItemSchema": "個人",
  "formDemo.arrayFields.tags": "タグ（文字列配列）",
  "formDemo.arrayFields.tagsReadOnly": "タグ（文字列配列, readOnly）",
  "formDemo.arrayFields.tags2": "タグ2（文字列配列, multipleString）",
  "formDemo.arrayFields.friends.item.name": "名（必須）",
  "formDemo.arrayFields.friends.item.comment": "コメント(任意）",
  "formDemo.arrayFields.friends.item.age": "年齢",
  "formDemo.arrayFields.friends.item.isMember": "会員",
  "formDemo.arrayFields.friends.item": "個人",
  "formDemo.arrayFields.friends": "友人（オブジェクト配列）",
  "formDemo.arrayFields.friendsTable": "友人（オブジェクト配列, table）",
  "formDemo.arrayFields.friendsTableReadOnly":
    "友人（オブジェクト配列, table, readOnly）",
  "formDemo.arrayFields.friendsReadOnly.item.name": "名（必須）",
  "formDemo.arrayFields.friendsReadOnly.item.comment": "コメント(任意）",
  "formDemo.arrayFields.friendsReadOnly.item.age": "年齢",
  "formDemo.arrayFields.friendsReadOnly.item.isMember": "会員",
  "formDemo.arrayFields.friendsReadOnly.item": "個人",
  "formDemo.arrayFields.friendsReadOnly": "友人（オブジェクト配列, readOnly）",
  "formDemo.arrayFields.message.compute":
    "配列フィールドでは、動的にアイテムの追加・削除ができます。タグは単純な文字列配列、友人はオブジェクト配列です。uiType: table を指定すると、object 配列を表形式で編集できます。配列のIDは { hidden: true } 使って非表示にしています。",
} satisfies MessagesOf<typeof en>;
