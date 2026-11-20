import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "enumSelect";
export const title = "zf.enum";
export const description = msgKey(
  "formDemo.page.enumSelect.description" /* i18n: 決まった選択肢から、ラベル付きで選ぶ */,
);
export const icon = IconListCheck;
export const category = "Basic";

// 色は、色調（明度・彩度）が近いものを 3 つずつまとめ、色調ごとに色相を散らす。
// 鮮やか（.6）・明るい（.4）・パステル（.1）・深い（.9）は Mantine のテーマ色、
// くすみ・淡いグレイッシュ・暗いくすみは Mantine に無い色調なので RGB で指定する
const hobbyLiterals = [
  z.literal("reading").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.reading" /* i18n: 読書 */),
    color: "blue.6",
  }),
  z.literal("sports").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.sports" /* i18n: スポーツ */,
    ),
    color: "green.6",
  }),
  z.literal("music").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.music" /* i18n: 音楽 */),
    color: "red.6",
  }),
  z.literal("gaming").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.gaming" /* i18n: ゲーム */,
    ),
    color: "violet.4",
  }),
  z.literal("travel").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.travel" /* i18n: 旅行 */),
    color: "yellow.4",
  }),
  z.literal("cooking").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.cooking" /* i18n: 料理 */),
    color: "orange.4",
  }),
  z.literal("baking").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.baking" /* i18n: お菓子作り */,
    ),
    color: "pink.1",
  }),
  z.literal("photography").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.photography" /* i18n: 写真 */,
    ),
    color: "cyan.1",
  }),
  z.literal("movies").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.movies" /* i18n: 映画 */),
    color: "lime.1",
  }),
  z.literal("anime").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.anime" /* i18n: アニメ */),
    color: "grape.9",
  }),
  z.literal("hiking").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.hiking" /* i18n: ハイキング */,
    ),
    color: "teal.9",
  }),
  z.literal("camping").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.camping" /* i18n: キャンプ */,
    ),
    color: "indigo.9",
  }),
  z.literal("fishing").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.fishing" /* i18n: 釣り */),
    color: "#779eba",
  }),
  z.literal("cycling").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.cycling" /* i18n: サイクリング */,
    ),
    color: "#b88997",
  }),
  z.literal("running").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.running" /* i18n: ランニング */,
    ),
    color: "#939e74",
  }),
  z.literal("yoga").register(zf.literal.registry, {
    label: msgKey("formDemo.enumSelect.hobbyLiterals.yoga" /* i18n: ヨガ */),
    color: "#c0bacf",
  }),
  z.literal("drawing").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.drawing" /* i18n: イラスト */,
    ),
    color: "#cdbaab",
  }),
  z.literal("crafts").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.crafts" /* i18n: ハンドメイド */,
    ),
    color: "#aac4be",
  }),
  z.literal("programming").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.programming" /* i18n: プログラミング */,
    ),
    color: "#294751",
  }),
  z.literal("boardgames").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.boardgames" /* i18n: ボードゲーム */,
    ),
    color: "#553b32",
  }),
  z.literal("karaoke").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.enumSelect.hobbyLiterals.karaoke" /* i18n: カラオケ */,
    ),
    color: "#513a49",
  }),
] as const;

type Hobby = z.output<(typeof hobbyLiterals)[number]>;

export const schema = z
  .object({
    favoriteHobby: zf
      .enum(hobbyLiterals)
      .register(zf.enum.registry, {
        label: msgKey(
          "formDemo.enumSelect.favoriteHobby" /* i18n: 一番好きな趣味(uiType: badge) */,
        ),
        uiType: "badge",
      })
      .optional(),
    favoriteHobbyRequired: zf.enum(hobbyLiterals).register(zf.enum.registry, {
      label: msgKey(
        "formDemo.enumSelect.favoriteHobbyRequired" /* i18n: 一番好きな趣味(必須） */,
      ),
    }),
    hobbies: zf
      .array(zf.enum(hobbyLiterals))
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.enumSelect.hobbies" /* i18n: 趣味(uiType: multipleEnumBadge) */,
        ),
        uiType: "multipleEnumBadge",
      })
      .optional(),
    hobbiesRequired: zf
      .array(zf.enum(hobbyLiterals))
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.enumSelect.hobbiesRequired" /* i18n: 趣味(必須) */,
        ),
        uiType: "multipleEnum",
      }),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.enumSelect.message.compute" /* i18n: zf.enumで1つの選択肢を、zf.array(zf.enum())で複数選択を表現します */,
        ),
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
