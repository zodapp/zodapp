import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "enumSelect";
export const title = "Enum";
export const description = "Enum型とLiteral型による選択肢の実装";
export const icon = IconListCheck;
export const category = "Basic";

const hobbyLiterals = [
  z
    .literal("reading")
    .register(zf.literal.registry, { label: "読書", color: "blue.6" }),
  z
    .literal("sports")
    .register(zf.literal.registry, { label: "スポーツ", color: "green.6" }),
  z
    .literal("music")
    .register(zf.literal.registry, { label: "音楽", color: "red.6" }),
  z
    .literal("gaming")
    .register(zf.literal.registry, { label: "ゲーム", color: "grape.6" }),
  z
    .literal("travel")
    .register(zf.literal.registry, { label: "旅行", color: "yellow.6" }),
  z
    .literal("cooking")
    .register(zf.literal.registry, { label: "料理", color: "orange.6" }),
  z
    .literal("baking")
    .register(zf.literal.registry, { label: "お菓子作り", color: "pink.6" }),
  z
    .literal("photography")
    .register(zf.literal.registry, { label: "写真", color: "cyan.6" }),
  z
    .literal("movies")
    .register(zf.literal.registry, { label: "映画", color: "indigo.8" }),
  z
    .literal("anime")
    .register(zf.literal.registry, { label: "アニメ", color: "violet.6" }),
  z
    .literal("hiking")
    .register(zf.literal.registry, { label: "ハイキング", color: "teal.6" }),
  z
    .literal("camping")
    .register(zf.literal.registry, { label: "キャンプ", color: "lime.6" }),
  z
    .literal("fishing")
    .register(zf.literal.registry, { label: "釣り", color: "indigo.6" }),
  z
    .literal("cycling")
    .register(zf.literal.registry, { label: "サイクリング", color: "blue.8" }),
  z
    .literal("running")
    .register(zf.literal.registry, { label: "ランニング", color: "green.8" }),
  z
    .literal("yoga")
    .register(zf.literal.registry, { label: "ヨガ", color: "red.8" }),
  z
    .literal("drawing")
    .register(zf.literal.registry, { label: "イラスト", color: "grape.8" }),
  z.literal("crafts").register(zf.literal.registry, {
    label: "ハンドメイド",
    color: "violet.8",
  }),
  z.literal("programming").register(zf.literal.registry, {
    label: "プログラミング",
    color: "teal.8",
  }),
  z.literal("boardgames").register(zf.literal.registry, {
    label: "ボードゲーム",
    color: "orange.8",
  }),
  z
    .literal("karaoke")
    .register(zf.literal.registry, { label: "カラオケ", color: "pink.8" }),
] as const;

type Hobby = z.output<(typeof hobbyLiterals)[number]>;

export const schema = z
  .object({
    favoriteHobby: zf
      .enum(hobbyLiterals)
      .register(zf.enum.registry, {
        label: "一番好きな趣味(uiType: badge)",
        uiType: "badge",
      })
      .optional(),
    favoriteHobbyRequired: zf
      .enum(hobbyLiterals)
      .register(zf.enum.registry, { label: "一番好きな趣味(必須）" }),
    hobbies: zf
      .array(zf.enum(hobbyLiterals))
      .register(zf.array.registry, {
        label: "趣味(uiType: multipleEnumBudge)",
        uiType: "multipleEnumBudge",
      })
      .optional(),
    hobbiesRequired: zf
      .array(zf.enum(hobbyLiterals))
      .register(zf.array.registry, {
        label: "趣味(必須)",
        uiType: "multipleEnum",
      }),
    message: zfReact
      .message()
      .register(zfReact.message.registry, {
        content:
          "zf.enumで1つの選択肢を、zf.array(zf.enum())で複数選択を表現します",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  favoriteHobby: "reading",
  favoriteHobbyRequired: undefined as unknown as Hobby,
  hobbies: ["reading", "music"],
  hobbiesRequired: undefined as unknown as Hobby[],
};

export type SchemaType = z.infer<typeof schema>;
