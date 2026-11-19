import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "enumSelect";
export const title = "zf.enum";
export const description = "決まった選択肢から、ラベル付きで選ぶ";
export const icon = IconListCheck;
export const category = "Basic";

// 色は、色調（明度・彩度）が近いものを 3 つずつまとめ、色調ごとに色相を散らす。
// 鮮やか（.6）・明るい（.4）・パステル（.1）・深い（.9）は Mantine のテーマ色、
// くすみ・淡いグレイッシュ・暗いくすみは Mantine に無い色調なので RGB で指定する
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
    .register(zf.literal.registry, { label: "ゲーム", color: "violet.4" }),
  z
    .literal("travel")
    .register(zf.literal.registry, { label: "旅行", color: "yellow.4" }),
  z
    .literal("cooking")
    .register(zf.literal.registry, { label: "料理", color: "orange.4" }),
  z
    .literal("baking")
    .register(zf.literal.registry, { label: "お菓子作り", color: "pink.1" }),
  z
    .literal("photography")
    .register(zf.literal.registry, { label: "写真", color: "cyan.1" }),
  z
    .literal("movies")
    .register(zf.literal.registry, { label: "映画", color: "lime.1" }),
  z
    .literal("anime")
    .register(zf.literal.registry, { label: "アニメ", color: "grape.9" }),
  z
    .literal("hiking")
    .register(zf.literal.registry, { label: "ハイキング", color: "teal.9" }),
  z
    .literal("camping")
    .register(zf.literal.registry, { label: "キャンプ", color: "indigo.9" }),
  z
    .literal("fishing")
    .register(zf.literal.registry, { label: "釣り", color: "#779eba" }),
  z
    .literal("cycling")
    .register(zf.literal.registry, { label: "サイクリング", color: "#b88997" }),
  z
    .literal("running")
    .register(zf.literal.registry, { label: "ランニング", color: "#939e74" }),
  z
    .literal("yoga")
    .register(zf.literal.registry, { label: "ヨガ", color: "#c0bacf" }),
  z
    .literal("drawing")
    .register(zf.literal.registry, { label: "イラスト", color: "#cdbaab" }),
  z.literal("crafts").register(zf.literal.registry, {
    label: "ハンドメイド",
    color: "#aac4be",
  }),
  z.literal("programming").register(zf.literal.registry, {
    label: "プログラミング",
    color: "#294751",
  }),
  z.literal("boardgames").register(zf.literal.registry, {
    label: "ボードゲーム",
    color: "#553b32",
  }),
  z
    .literal("karaoke")
    .register(zf.literal.registry, { label: "カラオケ", color: "#513a49" }),
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
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  favoriteHobby: "reading",
  favoriteHobbyRequired: undefined as unknown as Hobby,
  hobbies: ["reading", "music"],
  hobbiesRequired: undefined as unknown as Hobby[],
};

export type SchemaType = z.infer<typeof schema>;
