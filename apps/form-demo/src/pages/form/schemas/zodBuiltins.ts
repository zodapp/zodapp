import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconBraces } from "@tabler/icons-react";

export const formId = "zodBuiltins";
export const title = "zod の型をそのまま使う";
export const description =
  "pipe・transform・set・map・file・readonly・数値の enum・キーの決まった record・literal・再帰の上限を、zf を使わずに書いたときの表示";
export const icon = IconBraces;
export const category = "Standard";

// 数値の TS enum：選択肢の名前はキー（逆引きのキーは出さない）
enum Priority {
  Low = 1,
  Middle = 2,
  High = 3,
}

// optional な再帰の木。maxDepth で、描く深さの上限を 3 にする（その先の値は消さずに送る）
type Tree = { name: string; child?: Tree };
const treeNode = (): z.ZodType<Tree> =>
  z.object({
    name: z.string().register(zf.string.registry, { label: "名前" }),
    child: z.lazy(() => treeNode()).optional(),
  });

export const schema = z
  .object({
    // literal（値が 1 つ）：入力欄は出さず、値を入れておく
    kind: z.literal("article"),
    // literal（値が複数）：選択肢として出す
    visibility: z
      .literal(["public", "private"])
      .register(zf.literal.registry, {
        label: "公開範囲（literal の複数の値）",
      }),
    // pipe・transform：入力側の schema で欄を出し、送信では変換した値を渡す
    tags: z
      .string()
      .register(zf.string.registry, { label: "タグ（カンマ区切り → 配列）" })
      .transform((text) =>
        text
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    // set：選択肢があれば複数選択、文字列ならタグ入力
    channels: z
      .set(z.enum(["mail", "slack", "sms"]))
      .register(zf.set.registry, { label: "通知先（Set<enum>）" }),
    keywords: z
      .set(z.string())
      .register(zf.set.registry, { label: "キーワード（Set<string>）" }),
    // キーの決まった record：列挙したキーを固定の欄として並べる
    title: z
      .record(
        zf.enum([
          zf.literal("ja").register(zf.literal.registry, { label: "日本語" }),
          zf.literal("en").register(zf.literal.registry, { label: "英語" }),
        ]),
        z.string().min(1),
      )
      .register(zf.record.registry, {
        label: "タイトル（キーの決まった record）",
      }),
    // 数値の enum：object の形の enum・TS enum は、キーを選択肢の名前にする
    priority: z
      .enum(Priority)
      .register(zf.enum.registry, { label: "優先度（数値の TS enum）" }),
    // map：record の entries と同じ見た目で Map を書く
    limits: z
      .map(z.string(), z.number())
      .register(zf.common.registry, { label: "上限（Map<string, number>）" }),
    // file：File を値に持つファイルの入力欄
    attachment: z
      .file()
      .optional()
      .register(zf.common.registry, { label: "添付（z.file()）" }),
    // readonly：中をそのまま描く（zod の readonly は値を凍らせるだけ）
    author: z
      .object({
        name: z.string().register(zf.string.registry, { label: "著者名" }),
      })
      .readonly()
      .register(zf.common.registry, { label: "著者（readonly）" }),
    // 再帰の上限：lazy の入れ子の深さが maxDepth（3）を超えた所は描かず、注記を出す。
    // 中の lazy は、外の lazy の上限を引き継ぐ
    outline: z.lazy(() => treeNode()).register(zf.common.registry, {
      label: "目次（再帰。maxDepth: 3）",
      maxDepth: 3,
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
  author: { name: "山田" },
  outline: {
    name: "第1章",
    child: { name: "第1節", child: { name: "第1項", child: { name: "第1目" } } },
  },
};

export type SchemaType = z.infer<typeof schema>;
