import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconForms } from "@tabler/icons-react";

export const formId = "reactiveReadOnly";
export const title = msgKey(
  "formDemo.page.reactiveReadOnly.title" /* i18n: 閲覧専用の表示 (Reactive) */,
);
export const description = msgKey(
  "formDemo.page.reactiveReadOnly.description" /* i18n: reactiveComponentLibrary によるreadOnlyモード。非対応型（bigint, tuple, array, discriminatedUnion）は除外。 */,
);
export const icon = IconForms;
export const category = "Reactive";
export const reactive = true;

const hobbyLiterals = [
  z.literal("reading").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveReadOnly.hobbyLiterals.reading" /* i18n: 読書 */,
    ),
    color: "blue.6",
  }),
  z.literal("sports").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveReadOnly.hobbyLiterals.sports" /* i18n: スポーツ */,
    ),
    color: "green.6",
  }),
  z.literal("music").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveReadOnly.hobbyLiterals.music" /* i18n: 音楽 */,
    ),
    color: "red.6",
  }),
  z.literal("gaming").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveReadOnly.hobbyLiterals.gaming" /* i18n: ゲーム */,
    ),
    color: "grape.6",
  }),
] as const;

export const schema = z
  .object({
    firstName: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveReadOnly.firstName" /* i18n: 名(string) */,
        ),
        uiType: "text",
      })
      .optional(),
    lastName: zf
      .string()
      .min(1)
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.reactiveReadOnly.lastName" /* i18n: 姓（string, 必須） */,
        ),
        uiType: "text",
      }),
    frequency: zf
      .number()
      .max(7)
      .min(0)
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.reactiveReadOnly.frequency" /* i18n: 1週間にお酒を飲む日数(number, slider) */,
        ),
        uiType: "slider",
      }),
    age: zf
      .number()
      .max(150)
      .min(0)
      .register(zf.number.registry, {
        label: msgKey("formDemo.reactiveReadOnly.age" /* i18n: 年齢(number) */),
      }),
    birthday: zf.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.reactiveReadOnly.birthday" /* i18n: 誕生日(date) */,
      ),
    }),
    isMember: zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.reactiveReadOnly.isMember" /* i18n: 会員(boolean) */,
      ),
    }),
    favoriteColor: zf.literal("red").register(zf.literal.registry, {
      label: msgKey(
        "formDemo.reactiveReadOnly.favoriteColor" /* i18n: 固定データ(literal) */,
      ),
    }),
    isConfirmed: zf
      .literal(
        true,
        msgKey(
          "formDemo.reactiveReadOnly.isConfirmed.literal" /* i18n: 承認してください */,
        ),
      )
      .register(zf.boolean.registry, {
        label: msgKey(
          "formDemo.reactiveReadOnly.isConfirmed" /* i18n: 承認済(literal型+booleanコンポーネントを強制) */,
        ),
      }),
    favoriteHobby: zf.enum(hobbyLiterals).register(zf.enum.registry, {
      label: msgKey(
        "formDemo.reactiveReadOnly.favoriteHobby" /* i18n: 一番好きな趣味(enum) */,
      ),
    }),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.reactiveReadOnly.message.compute" /* i18n: これはReactive版のreadOnlyモードサンプルです */,
        ),
    }),
  })
  .register(zf.object.registry, { readOnly: true });

export const defaultValues: z.input<typeof schema> = {
  firstName: "太郎",
  lastName: "山田",
  frequency: 3,
  age: 25,
  birthday: new Date("1999-01-01"),
  isMember: true,
  favoriteColor: "red",
  isConfirmed: undefined as unknown as true,
  favoriteHobby: "reading",
};

export type SchemaType = z.infer<typeof schema>;
