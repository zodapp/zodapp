import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "reactiveEnumSelect";
export const title = "zf.enum (Reactive)";
export const description = msgKey(
  "formDemo.page.reactiveEnumSelect.description" /* i18n: reactiveComponentLibrary によるEnum選択。array（複数選択）は非対応のため除外。 */,
);
export const icon = IconListCheck;
export const category = "Reactive";
export const reactive = true;

const hobbyLiterals = [
  z.literal("reading").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.reading" /* i18n: 読書 */,
    ),
    color: "blue.6",
  }),
  z.literal("sports").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.sports" /* i18n: スポーツ */,
    ),
    color: "green.6",
  }),
  z.literal("music").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.music" /* i18n: 音楽 */,
    ),
    color: "red.6",
  }),
  z.literal("gaming").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.gaming" /* i18n: ゲーム */,
    ),
    color: "grape.6",
  }),
  z.literal("travel").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.travel" /* i18n: 旅行 */,
    ),
    color: "yellow.6",
  }),
  z.literal("cooking").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.cooking" /* i18n: 料理 */,
    ),
    color: "orange.6",
  }),
  z.literal("baking").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.baking" /* i18n: お菓子作り */,
    ),
    color: "pink.6",
  }),
  z.literal("photography").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.photography" /* i18n: 写真 */,
    ),
    color: "cyan.6",
  }),
  z.literal("movies").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.movies" /* i18n: 映画 */,
    ),
    color: "indigo.8",
  }),
  z.literal("anime").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.anime" /* i18n: アニメ */,
    ),
    color: "violet.6",
  }),
  z.literal("hiking").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.hiking" /* i18n: ハイキング */,
    ),
    color: "teal.6",
  }),
  z.literal("camping").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.camping" /* i18n: キャンプ */,
    ),
    color: "lime.6",
  }),
  z.literal("fishing").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.fishing" /* i18n: 釣り */,
    ),
    color: "indigo.6",
  }),
  z.literal("cycling").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.cycling" /* i18n: サイクリング */,
    ),
    color: "blue.8",
  }),
  z.literal("running").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.running" /* i18n: ランニング */,
    ),
    color: "green.8",
  }),
  z.literal("yoga").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.yoga" /* i18n: ヨガ */,
    ),
    color: "red.8",
  }),
  z.literal("drawing").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.drawing" /* i18n: イラスト */,
    ),
    color: "grape.8",
  }),
  z.literal("crafts").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.crafts" /* i18n: ハンドメイド */,
    ),
    color: "violet.8",
  }),
  z.literal("programming").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.programming" /* i18n: プログラミング */,
    ),
    color: "teal.8",
  }),
  z.literal("boardgames").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.boardgames" /* i18n: ボードゲーム */,
    ),
    color: "orange.8",
  }),
  z.literal("karaoke").register(zf.literal.registry, {
    label: msgKey(
      "formDemo.reactiveEnumSelect.hobbyLiterals.karaoke" /* i18n: カラオケ */,
    ),
    color: "pink.8",
  }),
] as const;

type Hobby = z.output<(typeof hobbyLiterals)[number]>;

export const schema = z
  .object({
    favoriteHobby: zf
      .enum(hobbyLiterals)
      .register(zf.enum.registry, {
        label: msgKey(
          "formDemo.reactiveEnumSelect.favoriteHobby" /* i18n: 一番好きな趣味(uiType: badge) */,
        ),
        uiType: "badge",
      })
      .optional(),
    favoriteHobbyRequired: zf.enum(hobbyLiterals).register(zf.enum.registry, {
      label: msgKey(
        "formDemo.reactiveEnumSelect.favoriteHobbyRequired" /* i18n: 一番好きな趣味(必須） */,
      ),
    }),
    message: zfReact.computed().register(zf.computed.registry, {
      compute: () =>
        msgKey(
          "formDemo.reactiveEnumSelect.message.compute" /* i18n: Reactive版ではzf.enumの単一選択のみ対応。array（複数選択）は非対応。 */,
        ),
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  favoriteHobby: "reading",
  favoriteHobbyRequired: undefined as unknown as Hobby,
};

export type SchemaType = z.infer<typeof schema>;
