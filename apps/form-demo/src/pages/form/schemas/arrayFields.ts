import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconBrackets } from "@tabler/icons-react";

export const formId = "arrayFields";
export const title = "zf.array";
export const description = msgKey(
  "formDemo.page.arrayFields.description" /* i18n: 行を追加・削除しながら入力する */,
);
export const icon = IconBrackets;
export const category = "Basic";

const friendTableItemSchema = z
  .object({
    id: zf.string().register(zf.string.registry, { label: "ID", hidden: true }),
    name: zf.string().register(zf.string.registry, {
      label: msgKey(
        "formDemo.arrayFields.friendTableItemSchema.name" /* i18n: 名前 */,
      ),
      width: 160,
    }),
    comment: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.arrayFields.friendTableItemSchema.comment" /* i18n: コメント */,
        ),
        width: 240,
      })
      .optional(),
    age: zf
      .number()
      .max(150)
      .min(0)
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.arrayFields.friendTableItemSchema.age" /* i18n: 年齢 */,
        ),
        width: 100,
        align: "right",
      })
      .optional(),
    isMember: zf
      .boolean()
      .register(zf.boolean.registry, {
        label: msgKey(
          "formDemo.arrayFields.friendTableItemSchema.isMember" /* i18n: 会員 */,
        ),
        width: 80,
      })
      .optional(),
  })
  .register(zf.object.registry, {
    label: msgKey(
      "formDemo.arrayFields.friendTableItemSchema" /* i18n: 個人 */,
    ),
    properties: ["name", "age", "isMember", "comment", "id"],
  })
  .default(() => ({
    id: undefined as unknown as string,
    name: "auto-name",
    comment: "comment test",
  }));

export const schema = z
  .object({
    tags: zf
      .array(zf.string().min(3).max(10))
      .min(1)
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.tags" /* i18n: タグ（文字列配列） */,
        ),
      }),
    tagsReadOnly: zf
      .array(zf.string().min(3).max(10))
      .min(1)
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.tagsReadOnly" /* i18n: タグ（文字列配列, readOnly） */,
        ),
        readOnly: true,
      }),
    tags2: zf
      .array(zf.string().min(3).max(10))
      .min(1)
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.tags2" /* i18n: タグ2（文字列配列, multipleString） */,
        ),
        uiType: "multipleString",
      }),
    friends: zf
      .array(
        z
          .object({
            id: zf
              .string()
              .register(zf.string.registry, { label: "ID", hidden: true }),
            name: zf.string().register(zf.string.registry, {
              label: msgKey(
                "formDemo.arrayFields.friends.item.name" /* i18n: 名（必須） */,
              ),
            }),
            comment: zf
              .string()
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.arrayFields.friends.item.comment" /* i18n: コメント(任意） */,
                ),
              })
              .optional(),
            age: zf
              .number()
              .max(150)
              .min(0)
              .register(zf.number.registry, {
                label: msgKey(
                  "formDemo.arrayFields.friends.item.age" /* i18n: 年齢 */,
                ),
              })
              .optional(),
            isMember: zf
              .boolean()
              .register(zf.boolean.registry, {
                label: msgKey(
                  "formDemo.arrayFields.friends.item.isMember" /* i18n: 会員 */,
                ),
              })
              .optional(),
          })
          .register(zf.object.registry, {
            label: msgKey("formDemo.arrayFields.friends.item" /* i18n: 個人 */),
            uiType: "box",
          })
          .default(() => ({
            id: undefined as unknown as string,
            name: "auto-name",
            comment: "comment test",
          })),
      )
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.friends" /* i18n: 友人（オブジェクト配列） */,
        ),
        discriminator: "id",
      }),
    friendsTable: zf
      .array(friendTableItemSchema)
      .min(1)
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.friendsTable" /* i18n: 友人（オブジェクト配列, table） */,
        ),
        uiType: "table",
        discriminator: "id",
      }),
    friendsTableReadOnly: zf
      .array(friendTableItemSchema)
      .min(1)
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.friendsTableReadOnly" /* i18n: 友人（オブジェクト配列, table, readOnly） */,
        ),
        uiType: "table",
        readOnly: true,
        discriminator: "id",
      }),
    friendsReadOnly: zf
      .array(
        z
          .object({
            id: zf
              .string()
              .register(zf.string.registry, { label: "ID", hidden: true }),
            name: zf.string().register(zf.string.registry, {
              label: msgKey(
                "formDemo.arrayFields.friendsReadOnly.item.name" /* i18n: 名（必須） */,
              ),
            }),
            comment: zf
              .string()
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.arrayFields.friendsReadOnly.item.comment" /* i18n: コメント(任意） */,
                ),
              })
              .optional(),
            age: zf
              .number()
              .max(150)
              .min(0)
              .register(zf.number.registry, {
                label: msgKey(
                  "formDemo.arrayFields.friendsReadOnly.item.age" /* i18n: 年齢 */,
                ),
              })
              .optional(),
            isMember: zf
              .boolean()
              .register(zf.boolean.registry, {
                label: msgKey(
                  "formDemo.arrayFields.friendsReadOnly.item.isMember" /* i18n: 会員 */,
                ),
              })
              .optional(),
          })
          .register(zf.object.registry, {
            label: msgKey(
              "formDemo.arrayFields.friendsReadOnly.item" /* i18n: 個人 */,
            ),
            uiType: "box",
          })
          .default(() => ({
            id: undefined as unknown as string,
            name: "auto-name",
            comment: "comment test",
          })),
      )
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.arrayFields.friendsReadOnly" /* i18n: 友人（オブジェクト配列, readOnly） */,
        ),
        readOnly: true,
        discriminator: "id",
      }),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.arrayFields.message.compute" /* i18n: 配列フィールドでは、動的にアイテムの追加・削除ができます。タグは単純な文字列配列、友人はオブジェクト配列です。uiType: table を指定すると、object 配列を表形式で編集できます。配列のIDは { hidden: true } 使って非表示にしています。 */,
        ),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  tags: ["tag1", "tag2", "tag3"],
  tags2: ["tag1", "tag2"],
  tagsReadOnly: ["tag1", "tag2", "tag3"],
  friends: [
    { id: "1", name: "Alice", comment: "Colleague" },
    { id: "2", name: "Bob", comment: "Friend" },
  ],
  friendsTable: [
    { id: "1", name: "Alice", age: 32, isMember: true, comment: "Colleague" },
    { id: "2", name: "Bob", age: 28, isMember: false, comment: "Friend" },
  ],
  friendsTableReadOnly: [
    { id: "1", name: "Alice", age: 32, isMember: true, comment: "Colleague" },
    { id: "2", name: "Bob", age: 28, isMember: false, comment: "Friend" },
  ],
  friendsReadOnly: [
    { id: "1", name: "Alice", comment: "Colleague" },
    { id: "2", name: "Bob", comment: "Friend" },
  ],
};

export type SchemaType = z.infer<typeof schema>;
