import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "enumSelect";
export const title = "zf.enum";
export const description = "決まった選択肢から、ラベル付きで選ぶ";
export const icon = IconListCheck;
export const category = "Basic";

// 色は色相（Mantine の 12 色）と濃さ（淡い .2〜.3・中間 .5〜.6・濃い .8〜.9）が偏らないように散らす。
// RGB 指定（#hex）の例も混ぜている
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
    .register(zf.literal.registry, { label: "旅行", color: "yellow.5" }),
  z
    .literal("cooking")
    .register(zf.literal.registry, { label: "料理", color: "orange.6" }),
  z
    .literal("baking")
    .register(zf.literal.registry, { label: "お菓子作り", color: "pink.3" }),
  z
    .literal("photography")
    .register(zf.literal.registry, { label: "写真", color: "cyan.2" }),
  z
    .literal("movies")
    .register(zf.literal.registry, { label: "映画", color: "indigo.9" }),
  z
    .literal("anime")
    .register(zf.literal.registry, { label: "アニメ", color: "violet.3" }),
  z
    .literal("hiking")
    .register(zf.literal.registry, { label: "ハイキング", color: "teal.8" }),
  z
    .literal("camping")
    .register(zf.literal.registry, { label: "キャンプ", color: "lime.3" }),
  z
    .literal("fishing")
    .register(zf.literal.registry, { label: "釣り", color: "blue.2" }),
  z
    .literal("cycling")
    .register(zf.literal.registry, { label: "サイクリング", color: "lime.9" }),
  z
    .literal("running")
    .register(zf.literal.registry, { label: "ランニング", color: "green.2" }),
  z
    .literal("yoga")
    .register(zf.literal.registry, { label: "ヨガ", color: "violet.8" }),
  z
    .literal("drawing")
    .register(zf.literal.registry, { label: "イラスト", color: "pink.8" }),
  z.literal("crafts").register(zf.literal.registry, {
    label: "ハンドメイド",
    color: "orange.2",
  }),
  z.literal("programming").register(zf.literal.registry, {
    label: "プログラミング",
    color: "#2f4858",
  }),
  z.literal("boardgames").register(zf.literal.registry, {
    label: "ボードゲーム",
    color: "#8d6e63",
  }),
  z
    .literal("karaoke")
    .register(zf.literal.registry, { label: "カラオケ", color: "red.9" }),
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
        label: "趣味(uiType: multipleEnumBadge)",
        uiType: "multipleEnumBadge",
      })
      .optional(),
    hobbiesRequired: zf
      .array(zf.enum(hobbyLiterals))
      .register(zf.array.registry, {
        label: "趣味(必須)",
        uiType: "multipleEnum",
      }),
    message: zfReact
      .computed()
      .register(zf.computed.registry, {
        compute: () =>
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
