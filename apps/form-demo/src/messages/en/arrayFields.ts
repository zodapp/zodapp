import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（arrayFields） */
export const en = defineMessages({
  "formDemo.page.arrayFields.description":
    "Enter values while adding and removing rows",
  "formDemo.arrayFields.friendTableItemSchema.name": "Name",
  "formDemo.arrayFields.friendTableItemSchema.comment": "Comment",
  "formDemo.arrayFields.friendTableItemSchema.age": "Age",
  "formDemo.arrayFields.friendTableItemSchema.isMember": "Member",
  "formDemo.arrayFields.friendTableItemSchema": "Person",
  "formDemo.arrayFields.tags": "Tags (string array)",
  "formDemo.arrayFields.tagsReadOnly": "Tags (string array, readOnly)",
  "formDemo.arrayFields.tags2": "Tags 2 (string array, multipleString)",
  "formDemo.arrayFields.friends.item.name": "First name (required)",
  "formDemo.arrayFields.friends.item.comment": "Comment (optional)",
  "formDemo.arrayFields.friends.item.age": "Age",
  "formDemo.arrayFields.friends.item.isMember": "Member",
  "formDemo.arrayFields.friends.item": "Person",
  "formDemo.arrayFields.friends": "Friends (object array)",
  "formDemo.arrayFields.friendsTable": "Friends (object array, table)",
  "formDemo.arrayFields.friendsTableReadOnly":
    "Friends (object array, table, readOnly)",
  "formDemo.arrayFields.friendsReadOnly.item.name": "First name (required)",
  "formDemo.arrayFields.friendsReadOnly.item.comment": "Comment (optional)",
  "formDemo.arrayFields.friendsReadOnly.item.age": "Age",
  "formDemo.arrayFields.friendsReadOnly.item.isMember": "Member",
  "formDemo.arrayFields.friendsReadOnly.item": "Person",
  "formDemo.arrayFields.friendsReadOnly": "Friends (object array, readOnly)",
  "formDemo.arrayFields.message.compute":
    "Array fields let you add and remove items dynamically. Tags are a plain string array, and friends are an object array. With uiType: table, an object array is edited as a table. Array IDs are hidden with { hidden: true }.",
});
