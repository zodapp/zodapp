import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconBrackets } from "@tabler/icons-react";

export const formId = "arrayFields";
export const title = "Array";
export const description = "配列型による動的なフィールド追加・削除";
export const icon = IconBrackets;
export const category = "Basic";

const friendTableItemSchema = z
  .object({
    id: zf.string().register(zf.string.registry, { label: "ID", hidden: true }),
    name: zf
      .string()
      .register(zf.string.registry, { label: "名前", width: 160 }),
    comment: zf
      .string()
      .register(zf.string.registry, {
        label: "コメント",
        width: 240,
      })
      .optional(),
    age: zf
      .number()
      .max(150)
      .min(0)
      .register(zf.number.registry, {
        label: "年齢",
        width: 100,
        align: "right",
      })
      .optional(),
    isMember: zf
      .boolean()
      .register(zf.boolean.registry, { label: "会員", width: 80 })
      .optional(),
  })
  .register(zf.object.registry, {
    label: "個人",
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
      .register(zf.array.registry, { label: "タグ（文字列配列）" }),
    tagsReadOnly: zf
      .array(zf.string().min(3).max(10))
      .min(1)
      .register(zf.array.registry, {
        label: "タグ（文字列配列, readOnly）",
        readOnly: true,
      }),
    tags2: zf
      .array(zf.string().min(3).max(10))
      .min(1)
      .register(zf.array.registry, {
        label: "タグ2（文字列配列, multipleString）",
        uiType: "multipleString",
      }),
    friends: zf
      .array(
        z
          .object({
            id: zf
              .string()
              .register(zf.string.registry, { label: "ID", hidden: true }),
            name: zf
              .string()
              .register(zf.string.registry, { label: "名（必須）" }),
            comment: zf
              .string()
              .register(zf.string.registry, { label: "コメント(任意）" })
              .optional(),
            age: zf
              .number()
              .max(150)
              .min(0)
              .register(zf.number.registry, { label: "年齢" })
              .optional(),
            isMember: zf
              .boolean()
              .register(zf.boolean.registry, { label: "会員" })
              .optional(),
          })
          .register(zf.object.registry, { label: "個人", uiType: "box" })
          .default(() => ({
            id: undefined as unknown as string,
            name: "auto-name",
            comment: "comment test",
          })),
      )
      .register(zf.array.registry, {
        label: "友人（オブジェクト配列）",
        discriminator: "id",
      }),
    friendsTable: zf
      .array(friendTableItemSchema)
      .min(1)
      .register(zf.array.registry, {
        label: "友人（オブジェクト配列, table）",
        uiType: "table",
        discriminator: "id",
      }),
    friendsTableReadOnly: zf
      .array(friendTableItemSchema)
      .min(1)
      .register(zf.array.registry, {
        label: "友人（オブジェクト配列, table, readOnly）",
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
            name: zf
              .string()
              .register(zf.string.registry, { label: "名（必須）" }),
            comment: zf
              .string()
              .register(zf.string.registry, { label: "コメント(任意）" })
              .optional(),
            age: zf
              .number()
              .max(150)
              .min(0)
              .register(zf.number.registry, { label: "年齢" })
              .optional(),
            isMember: zf
              .boolean()
              .register(zf.boolean.registry, { label: "会員" })
              .optional(),
          })
          .register(zf.object.registry, { label: "個人", uiType: "box" })
          .default(() => ({
            id: undefined as unknown as string,
            name: "auto-name",
            comment: "comment test",
          })),
      )
      .register(zf.array.registry, {
        label: "友人（オブジェクト配列, readOnly）",
        readOnly: true,
        discriminator: "id",
      }),
    message: zfReact
      .derived()
      .register(zf.derived.registry, {
        compute: () =>
          "配列フィールドでは、動的にアイテムの追加・削除ができます。タグは単純な文字列配列、友人はオブジェクト配列です。uiType: table を指定すると、object 配列を表形式で編集できます。配列のIDは { hidden: true } 使って非表示にしています。",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  tags: ["tag1", "tag2", "tag3"],
  tags2: ["tag1", "tag2"],
  tagsReadOnly: ["tag1", "tag2", "tag3"],
  friends: [
    { id: "1", name: "田中", comment: "同僚" },
    { id: "2", name: "佐藤", comment: "友人" },
  ],
  friendsTable: [
    { id: "1", name: "田中", age: 32, isMember: true, comment: "同僚" },
    { id: "2", name: "佐藤", age: 28, isMember: false, comment: "友人" },
  ],
  friendsTableReadOnly: [
    { id: "1", name: "田中", age: 32, isMember: true, comment: "同僚" },
    { id: "2", name: "佐藤", age: 28, isMember: false, comment: "友人" },
  ],
  friendsReadOnly: [
    { id: "1", name: "田中", comment: "同僚" },
    { id: "2", name: "佐藤", comment: "友人" },
  ],
};

export type SchemaType = z.infer<typeof schema>;
