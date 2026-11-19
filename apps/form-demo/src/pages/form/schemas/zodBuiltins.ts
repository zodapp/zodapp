import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconBraces } from "@tabler/icons-react";

export const formId = "zodBuiltins";
export const title = "zod の型をそのまま使う";
export const description =
  "pipe・transform・set・キーの決まった record・literal を、zf を使わずに書いたときの表示";
export const icon = IconBraces;
export const category = "Standard";

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
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  kind: "article",
  visibility: "public",
  tags: "zod, form",
  channels: new Set(["mail"]),
  keywords: new Set(["release"]),
  title: { ja: "お知らせ", en: "News" },
};

export type SchemaType = z.infer<typeof schema>;
