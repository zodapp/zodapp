import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconBraces } from "@tabler/icons-react";

export const formId = "zodBuiltins";
export const title = msgKey(
  "formDemo.page.zodBuiltins.title" /* i18n: zod の型をそのまま使う */,
);
export const description = msgKey(
  "formDemo.page.zodBuiltins.description" /* i18n: pipe・transform・set・map・file・readonly・数値の enum・キーの決まった record・literal・optional な再帰を、zf を使わずに書いたときの表示 */,
);
export const icon = IconBraces;
export const category = "Standard";

// 数値の TS enum：選択肢の名前はキー（逆引きのキーは出さない）
enum Priority {
  Low = 1,
  Middle = 2,
  High = 3,
}

// optional な再帰の木。値のある所まで描く（入れ子の深さの上限はかからない）
type Tree = { name: string; child?: Tree };
const treeNode = (): z.ZodType<Tree> =>
  z.object({
    name: z.string().register(zf.string.registry, {
      label: msgKey("formDemo.zodBuiltins.treeNode.name" /* i18n: 名前 */),
    }),
    child: z.lazy(() => treeNode()).optional(),
  });

export const schema = z
  .object({
    // literal（値が 1 つ）：入力欄は出さず、値を入れておく
    kind: z.literal("article"),
    // literal（値が複数）：選択肢として出す
    visibility: z.literal(["public", "private"]).register(zf.literal.registry, {
      label: msgKey(
        "formDemo.zodBuiltins.visibility" /* i18n: 公開範囲（literal の複数の値） */,
      ),
    }),
    // pipe・transform：入力側の schema で欄を出し、送信では変換した値を渡す
    tags: z
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.zodBuiltins.tags" /* i18n: タグ（カンマ区切り → 配列） */,
        ),
      })
      .transform((text) =>
        text
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    // set：選択肢があれば複数選択、文字列ならタグ入力
    channels: z
      .set(z.enum(["mail", "slack", "sms"]))
      .register(zf.set.registry, {
        label: msgKey(
          "formDemo.zodBuiltins.channels" /* i18n: 通知先（Set<enum>） */,
        ),
      }),
    keywords: z.set(z.string()).register(zf.set.registry, {
      label: msgKey(
        "formDemo.zodBuiltins.keywords" /* i18n: キーワード（Set<string>） */,
      ),
    }),
    // キーの決まった record：列挙したキーを固定の欄として並べる
    title: z
      .record(
        zf.enum([
          zf.literal("ja").register(zf.literal.registry, {
            label: msgKey(
              "formDemo.zodBuiltins.title.key.ja" /* i18n: 日本語 */,
            ),
          }),
          zf.literal("en").register(zf.literal.registry, {
            label: msgKey("formDemo.zodBuiltins.title.key.en" /* i18n: 英語 */),
          }),
        ]),
        z.string().min(1),
      )
      .register(zf.record.registry, {
        label: msgKey(
          "formDemo.zodBuiltins.title" /* i18n: タイトル（キーの決まった record） */,
        ),
      }),
    // 数値の enum：object の形の enum・TS enum は、キーを選択肢の名前にする
    priority: z.enum(Priority).register(zf.enum.registry, {
      label: msgKey(
        "formDemo.zodBuiltins.priority" /* i18n: 優先度（数値の TS enum） */,
      ),
    }),
    // map：record の entries と同じ見た目で Map を書く
    limits: z.map(z.string(), z.number()).register(zf.common.registry, {
      label: msgKey(
        "formDemo.zodBuiltins.limits" /* i18n: 上限（Map<string, number>） */,
      ),
    }),
    // file：File を値に持つファイルの入力欄
    attachment: z
      .file()
      .optional()
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.zodBuiltins.attachment" /* i18n: 添付（z.file()） */,
        ),
      }),
    // readonly：中をそのまま描く（zod の readonly は値を凍らせるだけ）
    author: z
      .object({
        name: z.string().register(zf.string.registry, {
          label: msgKey("formDemo.zodBuiltins.author.name" /* i18n: 著者名 */),
        }),
      })
      .readonly()
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.zodBuiltins.author" /* i18n: 著者（readonly） */,
        ),
      }),
    // optional な再帰：値のある所まで描く。optional を通るたびに、入れ子の深さの数え直しになるので、
    // 深くしても上限（既定 10）の注記は出ない
    outline: z
      .lazy(() => treeNode())
      .register(zf.common.registry, {
        label: msgKey(
          "formDemo.zodBuiltins.outline" /* i18n: 目次（optional な再帰） */,
        ),
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  kind: "article",
  visibility: "public",
  tags: "zod, form",
  channels: new Set(["mail"]),
  keywords: new Set(["release"]),
  title: { ja: "お知らせ", en: "News" },
  priority: Priority.Middle,
  limits: new Map([
    ["daily", 10],
    ["monthly", 100],
  ]),
  author: { name: "Smith" },
  outline: {
    name: "Chapter 1",
    child: {
      name: "Section 1",
      child: {
        name: "Article 1",
        child: { name: "Item 1", child: { name: "Part 1" } },
      },
    },
  },
};

export type SchemaType = z.infer<typeof schema>;
